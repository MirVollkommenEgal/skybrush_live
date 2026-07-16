import { describe, expect, it } from '@jest/globals';

import { validateFirmwareRelease } from '~/features/firmware-update/manifest';

const gitSha = '0123456789abcdef0123456789abcdef01234567';

const makeManifestFile = (overrides: Record<string, unknown> = {}) =>
  new File(
    [
      JSON.stringify({
        schemaVersion: 1,
        vehicleType: 'ArduCopter',
        boardName: 'DPH_FC_088',
        apjBoardId: 5602,
        gitSha,
        firmwareVersion: '4.6.2-custom',
        abinSize: 123,
        abinSha256: '0'.repeat(64),
        createdAt: '2026-07-16T12:00:00Z',
        releaseNotes: 'Test release',
        ...overrides,
      }),
    ],
    'release.json',
    { type: 'application/json' }
  );

describe('firmware release input validation', () => {
  it('accepts a non-empty BIN for server-side ABIN conversion', async () => {
    const result = await validateFirmwareRelease(
      new File([new Uint8Array([1, 2, 3])], 'arducopter.bin'),
      makeManifestFile()
    );

    expect(result.format).toBe('bin');
    expect(result.image.byteLength).toBe(3);
  });

  it('accepts a matching DPH_FC_088 APJ', async () => {
    const apj = new File(
      [
        JSON.stringify({
          magic: 'APJFWv1',
          board_id: 5602,
          image: 'compressed-image',
          image_size: 3,
          git_identity: gitSha,
        }),
      ],
      'arducopter.apj'
    );

    const result = await validateFirmwareRelease(apj, makeManifestFile());

    expect(result.format).toBe('apj');
  });

  it('rejects an APJ for another board', async () => {
    const apj = new File(
      [
        JSON.stringify({
          magic: 'APJFWv1',
          board_id: 1,
          image: 'compressed-image',
          image_size: 3,
        }),
      ],
      'arducopter.apj'
    );

    await expect(
      validateFirmwareRelease(apj, makeManifestFile())
    ).rejects.toMatchObject({
      code: 'wrongBoard',
    });
  });

  it('rejects empty source images', async () => {
    await expect(
      validateFirmwareRelease(
        new File([], 'arducopter.bin'),
        makeManifestFile()
      )
    ).rejects.toMatchObject({
      code: 'emptyImage',
    });
  });
});
