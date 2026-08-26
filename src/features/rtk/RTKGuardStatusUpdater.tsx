import delay from 'delay';
import { useEffect } from 'react';

import { updateRTKGuardStatus } from '~/features/rtk/slice';
import useMessageHub from '~/hooks/useMessageHub';
import { useAppDispatch } from '~/store/hooks';

import type { RTKGuardStatus } from './types';

type Props = {
  period?: number;
};

const RTKGuardStatusUpdater = ({ period = 1000 }: Props) => {
  const dispatch = useAppDispatch();
  const messageHub = useMessageHub();

  useEffect(() => {
    let finished = false;

    const updateStatus = async () => {
      while (!finished) {
        try {
          const loaded = await messageHub.query.isExtensionLoaded('rtk_guard');
          const status: RTKGuardStatus | null = loaded
            ? await messageHub.query.getRTKGuardStatus()
            : null;
          dispatch(updateRTKGuardStatus(status));
        } catch {
          // Older servers and configurations without rtk_guard remain valid.
          dispatch(updateRTKGuardStatus(null));
        }
        await delay(period);
      }
    };

    void updateStatus();
    return () => {
      finished = true;
    };
  }, [dispatch, messageHub, period]);

  return null;
};

export default RTKGuardStatusUpdater;
