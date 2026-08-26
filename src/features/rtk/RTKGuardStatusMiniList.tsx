import { useTranslation } from 'react-i18next';

import { MiniList, MiniListItem } from '@skybrush/mui-components';

import type { RTKGuardStatus } from './types';

type Props = {
  status: RTKGuardStatus | null;
};

const getIconPreset = (state: string): 'success' | 'warning' | 'error' => {
  if (state === 'GOOD' || state === 'READY' || state === 'CONSISTENT') {
    return 'success';
  }
  if (
    state === 'DEGRADED' ||
    state === 'NOT_COMPARABLE' ||
    state === 'UNKNOWN'
  ) {
    return 'warning';
  }
  return 'error';
};

const RTKGuardStatusMiniList = ({ status }: Props) => {
  const { t } = useTranslation();

  if (!status) {
    return (
      <MiniList style={{ minWidth: 230 }}>
        <MiniListItem
          iconPreset='warning'
          primaryText={t('RTKGuardStatus.unavailable')}
        />
      </MiniList>
    );
  }

  return (
    <MiniList style={{ minWidth: 260 }}>
      <MiniListItem
        iconPreset={getIconPreset(status.backup.state)}
        primaryText={t('RTKGuardStatus.backup')}
        secondaryText={t('RTKGuardStatus.backupDetails', {
          state: t(`RTKStatusMiniList.guardState.${status.backup.state}`),
          satellites: status.backup.satellites,
          age:
            status.backup.msmAge === null
              ? '—'
              : status.backup.msmAge.toFixed(1),
          cnr:
            status.backup.medianCnr === null
              ? '—'
              : status.backup.medianCnr.toFixed(1),
        })}
      />
      <MiniListItem
        iconPreset={getIconPreset(status.pair.state)}
        primaryText={t('RTKGuardStatus.pair')}
        secondaryText={t(`RTKStatusMiniList.guardState.${status.pair.state}`)}
      />
      <MiniListItem
        iconPreset={status.switch.armed ? 'success' : 'warning'}
        primaryText={t('RTKGuardStatus.autoSwitch')}
        secondaryText={
          status.switch.armed
            ? t('RTKGuardStatus.armed')
            : status.switch.automatic
              ? t('RTKGuardStatus.inhibited', {
                  reason: t(`RTKGuardReason.${status.switch.reason}`),
                })
              : t('RTKGuardStatus.disabled')
        }
      />
      <MiniListItem
        iconPreset={status.switch.mode === 'active' ? 'success' : 'warning'}
        primaryText={t('RTKGuardStatus.mode')}
        secondaryText={
          status.switch.mode === 'active'
            ? t('RTKGuardStatus.active')
            : t('RTKGuardStatus.dryRun')
        }
      />
    </MiniList>
  );
};

export default RTKGuardStatusMiniList;
