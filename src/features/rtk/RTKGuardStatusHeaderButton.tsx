import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { connect } from 'react-redux';

import { colorForStatus, Status } from '@skybrush/app-theme-mui';
import {
  GenericHeaderButton,
  LazyTooltip,
  SidebarBadge,
} from '@skybrush/mui-components';

import { isConnected } from '~/features/servers/selectors';
import AutoCheckBox from '~/icons/AutoCheckBox';
import type { RootState } from '~/store/reducers';

import RTKGuardConfigurationDialog from './RTKGuardConfigurationDialog';
import RTKGuardStatusMiniList from './RTKGuardStatusMiniList';
import RTKGuardStatusUpdater from './RTKGuardStatusUpdater';
import { getRTKGuardStatus } from './selectors';
import type { RTKGuardStatus } from './types';

type Props = {
  connected: boolean;
  status: RTKGuardStatus | null;
};

const getBadgeColor = (status: RTKGuardStatus | null) => {
  if (!status) {
    return colorForStatus(Status.WARNING);
  }
  if (status.backup.state === 'READY' && status.switch.armed) {
    return colorForStatus(Status.SUCCESS);
  }
  if (status.backup.state === 'FAILED' || status.backup.state === 'NOT_READY') {
    return colorForStatus(Status.ERROR);
  }
  return colorForStatus(Status.WARNING);
};

const buttonStyle: React.CSSProperties = {
  justifyContent: 'space-between',
  textAlign: 'right',
  width: 92,
};

const RTKGuardStatusHeaderButton = ({ connected, status }: Props) => {
  const { t } = useTranslation();
  const [configurationOpen, setConfigurationOpen] = useState(false);

  const label = status
    ? t(`RTKStatusMiniList.guardState.${status.backup.state}`)
    : '—';
  const secondaryLabel = status
    ? status.switch.mode === 'active'
      ? status.switch.armed
        ? t('RTKGuardStatus.armedShort')
        : t('RTKGuardStatus.inhibitedShort')
      : t('RTKGuardStatus.dryRunShort')
    : null;

  return (
    <>
      <LazyTooltip
        interactive
        content={<RTKGuardStatusMiniList status={status} />}
      >
        <GenericHeaderButton
          disabled={!connected}
          label={label}
          secondaryLabel={secondaryLabel}
          style={buttonStyle}
          onClick={() => setConfigurationOpen(true)}
        >
          <AutoCheckBox />
          <SidebarBadge
            anchor='topLeft'
            color={getBadgeColor(status)}
            offset={[24, 8]}
            visible={connected}
          />
          {connected && <RTKGuardStatusUpdater />}
        </GenericHeaderButton>
      </LazyTooltip>
      <RTKGuardConfigurationDialog
        open={configurationOpen}
        onClose={() => setConfigurationOpen(false)}
      />
    </>
  );
};

export default connect((state: RootState) => ({
  connected: isConnected(state),
  status: getRTKGuardStatus(state),
}))(RTKGuardStatusHeaderButton);
