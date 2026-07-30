import NavigateBefore from '@mui/icons-material/NavigateBefore';
import NavigateNext from '@mui/icons-material/NavigateNext';
import SaveAlt from '@mui/icons-material/SaveAlt';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Collapse from '@mui/material/Collapse';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import { Base64 } from 'js-base64';
import memoizee from 'memoizee';
import PropTypes from 'prop-types';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { connect } from 'react-redux';

import { BackgroundHint, DraggableDialog } from '@skybrush/mui-components';

import AsyncGuard from '~/components/AsyncGuard';
import FileButton from '~/components/FileButton';
import { selectableListOf } from '~/components/helpers/lists';
import {
  openUploadDialogForJob,
  setUploadAutoRetry,
} from '~/features/upload/slice';
import { useMessageHub } from '~/hooks';
import { formatData } from '~/utils/formatting';

import { JOB_TYPE } from './constants';
import { isFirmwareUpdateSetupDialogOpen } from './selectors';
import {
  FirmwareReleaseValidationError,
  validateFirmwareRelease,
} from './manifest';
import {
  hideFirmwareUpdateSetupDialog,
  showFirmwareUpdateSetupDialog,
} from './slice';

const NoFirmwareUpdateTargetsHint = () => {
  const { t } = useTranslation();
  return (
    <BackgroundHint
      header={t('firmwareUpdate.noTargets')}
      text={t('firmwareUpdate.enableServerSupport')}
      style={{ minHeight: 200 }}
    />
  );
};

const FirmwareUpdateTargetSelectorPresentation = selectableListOf(
  ({ name, id }, { onItemSelected }) => (
    <ListItemButton key={id} onClick={onItemSelected}>
      <ListItemText primary={name} secondary={id} />
    </ListItemButton>
  ),
  {
    dataProvider: 'items',
    displayName: 'FirmwareUpdateTargetSelectorPresentation',
    backgroundHint: <NoFirmwareUpdateTargetsHint />,
  }
);

const FirmwareUpdateTargetSelector = ({ getTargets, ...rest }) => {
  const { t } = useTranslation();
  return (
    <AsyncGuard
      func={getTargets}
      errorMessage={t('firmwareUpdate.targetLoadingError')}
      loadingMessage={t('firmwareUpdate.targetLoading')}
    >
      {(items) => (
        <FirmwareUpdateTargetSelectorPresentation items={items} {...rest} />
      )}
    </AsyncGuard>
  );
};

FirmwareUpdateTargetSelector.propTypes = {
  getTargets: PropTypes.func,
  onChange: PropTypes.func,
};

/**
 * Presentation component for the dialog that allows the user to assemble a
 * list of parameters to upload to the drones.
 */
const FirmwareUpdateSetupDialog = ({ onClose, onNext, open }) => {
  const [target, setTarget] = useState();
  const [imageFile, setImageFile] = useState();
  const [manifestFile, setManifestFile] = useState();
  const [validationError, setValidationError] = useState();
  const [validating, setValidating] = useState(false);
  const { t } = useTranslation();
  const manifestRequired =
    imageFile !== undefined && !imageFile.name.toLowerCase().endsWith('.apj');

  const messageHub = useMessageHub();
  const getTargets = useMemo(
    () =>
      memoizee(() => messageHub.query.getFirmwareUpdateTargets(), {
        maxAge: 10000,
        promise: true,
      }),
    [messageHub]
  );

  const onBack = useCallback(() => {
    setTarget();
    setImageFile();
    setManifestFile();
    setValidationError();
  }, []);

  const validateAndContinue = useCallback(async () => {
    if (!target || !imageFile || (manifestRequired && !manifestFile)) {
      return;
    }

    setValidating(true);
    setValidationError();
    try {
      const release = await validateFirmwareRelease(imageFile, manifestFile);
      onNext(target, release);
    } catch (error) {
      const key =
        error instanceof FirmwareReleaseValidationError
          ? error.code
          : 'unknown';
      setValidationError(t(`firmwareUpdate.validation.${key}`));
    } finally {
      setValidating(false);
    }
  }, [imageFile, manifestFile, manifestRequired, onNext, t, target]);

  return (
    <DraggableDialog
      fullWidth
      open={open}
      maxWidth='sm'
      title={t('firmwareUpdate.title', {
        target: target?.name ?? t('firmwareUpdate.firmware'),
      })}
      // TODO: Maybe call `getTargets.clear()` on close instead of `maxAge`
      onClose={onClose}
    >
      <DialogContent>
        <Box>
          <Collapse in={target === undefined}>
            <FirmwareUpdateTargetSelector
              getTargets={getTargets}
              onChange={(_event, value) => setTarget(value)}
            />
          </Collapse>
          <Collapse in={target !== undefined}>
            <Alert severity='warning' sx={{ mb: 2 }}>
              {t('firmwareUpdate.safetyNotice')}
            </Alert>
            <FileButton
              filter={['.abin', '.apj', '.bin']}
              style={{ width: '100%' }}
              onSelected={(file) => {
                setImageFile(file);
                setManifestFile();
                setValidationError();
              }}
            >
              <Box sx={{ textAlign: 'center' }}>
                <SaveAlt style={{ fontSize: 128 }} />
                <br />
                {imageFile === undefined
                  ? t('firmwareUpdate.selectImage')
                  : `${imageFile.name} (${formatData(imageFile.size)})`}
              </Box>
            </FileButton>
            {manifestRequired && (
              <FileButton
                filter={['.json', 'application/json']}
                style={{ width: '100%', marginTop: 16 }}
                onSelected={(file) => {
                  setManifestFile(file);
                  setValidationError();
                }}
              >
                {manifestFile === undefined
                  ? t('firmwareUpdate.selectManifest')
                  : manifestFile.name}
              </FileButton>
            )}
            {validationError && (
              <Alert severity='error' sx={{ mt: 2 }}>
                {validationError}
              </Alert>
            )}
          </Collapse>
        </Box>
        <Collapse in={target !== undefined}>
          <DialogActions>
            <Button startIcon={<NavigateBefore />} onClick={onBack}>
              {t('firmwareUpdate.back')}
            </Button>
            <Box sx={{ flex: 1 }} />
            <Button
              disabled={
                !imageFile || (manifestRequired && !manifestFile) || validating
              }
              endIcon={<NavigateNext />}
              onClick={validateAndContinue}
            >
              {validating
                ? t('firmwareUpdate.validating')
                : t('firmwareUpdate.next')}
            </Button>
          </DialogActions>
        </Collapse>
      </DialogContent>
    </DraggableDialog>
  );
};

FirmwareUpdateSetupDialog.propTypes = {
  onClose: PropTypes.func,
  onNext: PropTypes.func,
  open: PropTypes.bool,
};

export default connect(
  // mapStateToProps
  (state) => ({
    open: isFirmwareUpdateSetupDialogOpen(state),
  }),

  // mapDispatchToProps
  {
    onClose: hideFirmwareUpdateSetupDialog,
    onNext: (target, release) => (dispatch) => {
      dispatch(hideFirmwareUpdateSetupDialog());
      // A firmware operation must never be retried automatically after flash
      // erasure may have started.
      dispatch(setUploadAutoRetry(false));
      dispatch(
        openUploadDialogForJob({
          job: {
            type: JOB_TYPE,
            payload: {
              target: target.id,
              blob: Base64.fromUint8Array(release.image),
              format: release.format,
              manifest: release.manifest,
            },
          },
          options: {
            backAction: showFirmwareUpdateSetupDialog(),
          },
        })
      );
    },
  }
)(FirmwareUpdateSetupDialog);
