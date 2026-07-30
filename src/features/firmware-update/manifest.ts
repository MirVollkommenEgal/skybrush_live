export const DPH_FC_088_BOARD_ID = 5602;

export type FirmwareReleaseManifest = {
  schemaVersion: 1;
  vehicleType: 'ArduCopter';
  boardName: 'DPH_FC_088';
  apjBoardId: typeof DPH_FC_088_BOARD_ID;
  gitSha: string;
  firmwareVersion: string;
  abinSize: number;
  abinSha256: string;
  createdAt: string;
  releaseNotes: string;
};

type FirmwareReleaseManifestCandidate = Omit<
  FirmwareReleaseManifest,
  'apjBoardId'
> & {
  apjBoardId: number;
};

export type ValidatedFirmwareRelease = {
  format: FirmwareImageFormat;
  image: ArrayBuffer;
  manifest?: FirmwareReleaseManifest;
};

export type FirmwareImageFormat = 'abin' | 'apj' | 'bin';

export type FirmwareReleaseValidationErrorCode =
  | 'invalidImageExtension'
  | 'invalidManifestExtension'
  | 'invalidManifestJson'
  | 'invalidManifestSchema'
  | 'invalidApj'
  | 'apjGitMismatch'
  | 'wrongBoard'
  | 'emptyImage'
  | 'sizeMismatch'
  | 'hashMismatch';

export class FirmwareReleaseValidationError extends Error {
  readonly code: FirmwareReleaseValidationErrorCode;

  constructor(code: FirmwareReleaseValidationErrorCode) {
    super(code);
    this.name = 'FirmwareReleaseValidationError';
    this.code = code;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isHex = (value: unknown, length: number): value is string =>
  typeof value === 'string' &&
  new RegExp(`^[a-fA-F0-9]{${length}}$`).test(value);

const isGitIdentity = (value: unknown): value is string =>
  isHex(value, 8) || isHex(value, 40);

const isValidManifest = (
  value: unknown
): value is FirmwareReleaseManifestCandidate =>
  isRecord(value) &&
  value.schemaVersion === 1 &&
  value.vehicleType === 'ArduCopter' &&
  value.boardName === 'DPH_FC_088' &&
  typeof value.apjBoardId === 'number' &&
  isHex(value.gitSha, 40) &&
  typeof value.firmwareVersion === 'string' &&
  value.firmwareVersion.length > 0 &&
  typeof value.abinSize === 'number' &&
  Number.isSafeInteger(value.abinSize) &&
  value.abinSize > 0 &&
  isHex(value.abinSha256, 64) &&
  typeof value.createdAt === 'string' &&
  !Number.isNaN(Date.parse(value.createdAt)) &&
  typeof value.releaseNotes === 'string';

const sha256 = async (data: ArrayBuffer): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0')
  ).join('');
};

const getFirmwareImageFormat = (filename: string): FirmwareImageFormat => {
  const extension = filename.toLowerCase().match(/\.([^.]+)$/)?.[1];
  if (extension === 'abin' || extension === 'apj' || extension === 'bin') {
    return extension;
  }
  throw new FirmwareReleaseValidationError('invalidImageExtension');
};

const validateApj = (
  image: ArrayBuffer,
  manifest?: FirmwareReleaseManifestCandidate
): void => {
  let apj: unknown;
  try {
    apj = JSON.parse(new TextDecoder().decode(image));
  } catch {
    throw new FirmwareReleaseValidationError('invalidApj');
  }

  if (
    !isRecord(apj) ||
    apj.magic !== 'APJFWv1' ||
    apj.board_id !== DPH_FC_088_BOARD_ID ||
    typeof apj.image !== 'string' ||
    apj.image.length === 0 ||
    typeof apj.image_size !== 'number' ||
    !Number.isSafeInteger(apj.image_size) ||
    apj.image_size <= 0 ||
    (!manifest && !isGitIdentity(apj.git_identity))
  ) {
    throw new FirmwareReleaseValidationError(
      isRecord(apj) &&
        typeof apj.board_id === 'number' &&
        apj.board_id !== DPH_FC_088_BOARD_ID
        ? 'wrongBoard'
        : 'invalidApj'
    );
  }

  if (
    manifest &&
    typeof apj.git_identity === 'string' &&
    apj.git_identity.toLowerCase() !==
      manifest.gitSha.slice(0, apj.git_identity.length).toLowerCase()
  ) {
    throw new FirmwareReleaseValidationError('apjGitMismatch');
  }
};

export const validateFirmwareRelease = async (
  imageFile: File,
  manifestFile?: File
): Promise<ValidatedFirmwareRelease> => {
  const format = getFirmwareImageFormat(imageFile.name);

  const image = await imageFile.arrayBuffer();
  if (image.byteLength === 0) {
    throw new FirmwareReleaseValidationError('emptyImage');
  }

  if (format === 'apj' && !manifestFile) {
    validateApj(image);
    return { format, image };
  }

  if (!manifestFile) {
    throw new FirmwareReleaseValidationError('invalidManifestSchema');
  }

  if (!manifestFile.name.toLowerCase().endsWith('.json')) {
    throw new FirmwareReleaseValidationError('invalidManifestExtension');
  }

  let parsedManifest: unknown;
  try {
    parsedManifest = JSON.parse(await manifestFile.text());
  } catch {
    throw new FirmwareReleaseValidationError('invalidManifestJson');
  }

  if (!isValidManifest(parsedManifest)) {
    throw new FirmwareReleaseValidationError('invalidManifestSchema');
  }

  if (parsedManifest.apjBoardId !== DPH_FC_088_BOARD_ID) {
    throw new FirmwareReleaseValidationError('wrongBoard');
  }

  if (format === 'abin') {
    if (image.byteLength !== parsedManifest.abinSize) {
      throw new FirmwareReleaseValidationError('sizeMismatch');
    }
    if ((await sha256(image)) !== parsedManifest.abinSha256.toLowerCase()) {
      throw new FirmwareReleaseValidationError('hashMismatch');
    }
  } else if (format === 'apj') {
    validateApj(image, parsedManifest);
  }

  return {
    format,
    image,
    manifest: {
      ...parsedManifest,
      apjBoardId: DPH_FC_088_BOARD_ID,
    },
  };
};
