import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import CircularProgress from '@mui/material/CircularProgress';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormGroup from '@mui/material/FormGroup';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import ExpandMore from '@mui/icons-material/ExpandMore';
import { DraggableDialog } from '@skybrush/mui-components';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import handleError from '~/error-handling';
import { showSuccess } from '~/features/snackbar/actions';
import useMessageHub from '~/hooks/useMessageHub';

import type {
  RTKGuardConfiguration,
  RTKGuardHealthConfiguration,
} from './types';

type Props = {
  open: boolean;
  onClose: () => void;
};

type RTKPreset = {
  id: string;
  title: string;
};

type CompleteHealthConfiguration = Required<RTKGuardHealthConfiguration>;

type NumericHealthKey =
  | 'degraded_msm_age'
  | 'max_msm_age'
  | 'max_position_age'
  | 'maximum_position_error'
  | 'maximum_position_jump'
  | 'minimum_satellites'
  | 'minimum_common_satellites'
  | 'minimum_common_signals'
  | 'primary_failure_hold'
  | 'backup_ready_hold'
  | 'pair_recent_window'
  | 'epoch_tolerance'
  | 'maximum_phase_outlier_ratio'
  | 'phase_mad_multiplier'
  | 'phase_absolute_floor'
  | 'pair_disagreement_hold'
  | 'mass_cycle_slip_count'
  | 'cycle_slip_window'
  | 'minimum_cnr'
  | 'cnr_collapse_delta';

type FormState = {
  enabled: boolean;
  mode: 'dry_run' | 'active';
  primaryPresetId: string;
  backupPresetId: string;
  primaryEcef: string;
  backupEcef: string;
  switchingEnabled: boolean;
  confirmationTimeout: number;
  recordingDirectory: string;
  health: CompleteHealthConfiguration;
};

const DEFAULT_HEALTH: CompleteHealthConfiguration = {
  degraded_msm_age: 1.5,
  max_msm_age: 2.5,
  max_position_age: 30,
  maximum_position_error: 0.05,
  maximum_position_jump: 0.05,
  minimum_satellites: 10,
  minimum_common_satellites: 8,
  minimum_common_signals: 8,
  required_constellations: ['GPS', 'GALILEO'],
  primary_failure_hold: 2,
  backup_ready_hold: 10,
  pair_recent_window: 15,
  epoch_tolerance: 0.05,
  maximum_phase_outlier_ratio: 0.25,
  phase_mad_multiplier: 6,
  phase_absolute_floor: 0.03,
  pair_disagreement_hold: 2,
  mass_cycle_slip_count: 4,
  cycle_slip_window: 2,
  minimum_cnr: 25,
  cnr_collapse_delta: 8,
  enable_phase_comparison: true,
};

const HEALTH_FIELDS: Array<{
  key: NumericHealthKey;
  step: number;
}> = [
  { key: 'degraded_msm_age', step: 0.1 },
  { key: 'max_msm_age', step: 0.1 },
  { key: 'max_position_age', step: 1 },
  { key: 'maximum_position_error', step: 0.01 },
  { key: 'maximum_position_jump', step: 0.01 },
  { key: 'minimum_satellites', step: 1 },
  { key: 'minimum_common_satellites', step: 1 },
  { key: 'minimum_common_signals', step: 1 },
  { key: 'primary_failure_hold', step: 0.1 },
  { key: 'backup_ready_hold', step: 0.5 },
  { key: 'pair_recent_window', step: 1 },
  { key: 'epoch_tolerance', step: 0.01 },
  { key: 'maximum_phase_outlier_ratio', step: 0.05 },
  { key: 'phase_mad_multiplier', step: 0.5 },
  { key: 'phase_absolute_floor', step: 0.01 },
  { key: 'pair_disagreement_hold', step: 0.1 },
  { key: 'mass_cycle_slip_count', step: 1 },
  { key: 'cycle_slip_window', step: 0.1 },
  { key: 'minimum_cnr', step: 1 },
  { key: 'cnr_collapse_delta', step: 0.5 },
];

const CONSTELLATIONS = ['GPS', 'GLONASS', 'GALILEO', 'BEIDOU'];

const formatEcef = (value?: [number, number, number]) =>
  value?.map((coordinate) => String(coordinate)).join(', ') ?? '';

const parseEcef = (value: string): [number, number, number] | undefined => {
  const normalized = value.trim();
  if (!normalized) {
    return undefined;
  }
  const coordinates = normalized
    .split(/[\s,;]+/)
    .filter(Boolean)
    .map(Number);
  if (
    coordinates.length !== 3 ||
    coordinates.some((item) => !Number.isFinite(item))
  ) {
    throw new Error('invalid-ecef');
  }
  return [coordinates[0], coordinates[1], coordinates[2]];
};

const toFormState = (configuration: RTKGuardConfiguration): FormState => ({
  enabled: configuration.enabled ?? true,
  mode: configuration.mode ?? 'dry_run',
  primaryPresetId: configuration.primary?.preset_id ?? '',
  backupPresetId: configuration.backup?.preset_id ?? '',
  primaryEcef: formatEcef(configuration.primary?.expected_ecef),
  backupEcef: formatEcef(configuration.backup?.expected_ecef),
  switchingEnabled: configuration.switching?.enabled ?? false,
  confirmationTimeout: configuration.switching?.confirmation_timeout ?? 10,
  recordingDirectory: configuration.recording_directory ?? '',
  health: { ...DEFAULT_HEALTH, ...configuration.health },
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const RTKGuardConfigurationDialog = ({ open, onClose }: Props) => {
  const { t } = useTranslation();
  const messageHub = useMessageHub();
  const [configuration, setConfiguration] = useState<RTKGuardConfiguration>({});
  const [form, setForm] = useState<FormState>(() => toFormState({}));
  const [presets, setPresets] = useState<RTKPreset[]>([]);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [activatingPrimary, setActivatingPrimary] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  const load = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const [rawConfiguration, rawPresets, rawActivePresetId] =
        await Promise.all([
          messageHub.query.getConfigurationOfExtension('rtk_guard'),
          messageHub.query.getRTKPresets(),
          messageHub.query.getSelectedRTKPresetId(),
        ]);
      const loadedConfiguration: RTKGuardConfiguration = isRecord(
        rawConfiguration
      )
        ? rawConfiguration
        : {};
      const loadedPresets: RTKPreset[] = Array.isArray(rawPresets)
        ? rawPresets
            .filter(
              (preset): preset is RTKPreset =>
                isRecord(preset) &&
                typeof preset.id === 'string' &&
                typeof preset.title === 'string'
            )
            .map(({ id, title }) => ({ id, title }))
        : [];
      setConfiguration(loadedConfiguration);
      setForm(toFormState(loadedConfiguration));
      setPresets(loadedPresets);
      setActivePresetId(
        typeof rawActivePresetId === 'string' ? rawActivePresetId : null
      );
    } catch (loadError) {
      setError(t('RTKGuardConfigurationDialog.loadError'));
      handleError(loadError, { operation: 'load RTK guard configuration' });
    } finally {
      setLoading(false);
    }
  }, [messageHub, t]);

  useEffect(() => {
    if (open) {
      void load();
    }
  }, [load, open]);

  const updateHealth = (key: NumericHealthKey, value: number) => {
    setForm((current) => ({
      ...current,
      health: { ...current.health, [key]: value },
    }));
  };

  const activatePrimary = async () => {
    if (!form.primaryPresetId) {
      return;
    }
    setActivatingPrimary(true);
    setError(undefined);
    try {
      await messageHub.execute.setRTKCorrectionsSource(form.primaryPresetId);
      setActivePresetId(form.primaryPresetId);
      showSuccess(t('RTKGuardConfigurationDialog.primaryActivated'));
    } catch (activationError) {
      setError(t('RTKGuardConfigurationDialog.primaryActivationError'));
      handleError(activationError, { operation: 'activate RTK guard primary' });
    } finally {
      setActivatingPrimary(false);
    }
  };

  const save = async () => {
    setError(undefined);
    if (!form.primaryPresetId || !form.backupPresetId) {
      setError(t('RTKGuardConfigurationDialog.presetRequired'));
      return;
    }
    if (form.primaryPresetId === form.backupPresetId) {
      setError(t('RTKGuardConfigurationDialog.presetsMustDiffer'));
      return;
    }
    if (form.health.required_constellations.length === 0) {
      setError(t('RTKGuardConfigurationDialog.constellationRequired'));
      return;
    }
    if (
      form.confirmationTimeout <= 0 ||
      form.health.degraded_msm_age < 0 ||
      form.health.max_msm_age <= form.health.degraded_msm_age ||
      form.health.maximum_phase_outlier_ratio < 0 ||
      form.health.maximum_phase_outlier_ratio > 1
    ) {
      setError(t('RTKGuardConfigurationDialog.invalidThresholds'));
      return;
    }

    let primaryEcef: [number, number, number] | undefined;
    let backupEcef: [number, number, number] | undefined;
    try {
      primaryEcef = parseEcef(form.primaryEcef);
      backupEcef = parseEcef(form.backupEcef);
    } catch {
      setError(t('RTKGuardConfigurationDialog.invalidEcef'));
      return;
    }

    const updated: RTKGuardConfiguration = {
      ...configuration,
      enabled: form.enabled,
      mode: form.mode,
      primary: {
        ...configuration.primary,
        preset_id: form.primaryPresetId,
        expected_ecef: primaryEcef,
      },
      backup: {
        ...configuration.backup,
        preset_id: form.backupPresetId,
        expected_ecef: backupEcef,
      },
      health: { ...configuration.health, ...form.health },
      switching: {
        ...configuration.switching,
        enabled: form.switchingEnabled,
        allow_auto_failback: false,
        confirmation_timeout: form.confirmationTimeout,
      },
      recording_directory: form.recordingDirectory.trim() || undefined,
    };

    setSaving(true);
    try {
      const alreadyLoaded =
        await messageHub.query.isExtensionLoaded('rtk_guard');
      await messageHub.execute.configureExtension('rtk_guard', updated);
      if (alreadyLoaded) {
        await messageHub.execute.reloadExtension('rtk_guard');
      } else {
        await messageHub.execute.loadExtension('rtk_guard');
      }
      setConfiguration(updated);
      showSuccess(t('RTKGuardConfigurationDialog.saved'));
      onClose();
    } catch (saveError) {
      setError(t('RTKGuardConfigurationDialog.saveError'));
      handleError(saveError, { operation: 'save RTK guard configuration' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <DraggableDialog
      fullWidth
      open={open}
      maxWidth='md'
      title={t('RTKGuardConfigurationDialog.title')}
      onClose={saving ? undefined : onClose}
    >
      <DialogContent>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Stack spacing={2}>
            {error && <Alert severity='error'>{error}</Alert>}
            <FormControlLabel
              control={
                <Switch
                  checked={form.enabled}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      enabled: event.target.checked,
                    }))
                  }
                />
              }
              label={t('RTKGuardConfigurationDialog.enabled')}
            />

            <Box
              sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}
            >
              <TextField
                select
                label={t('RTKGuardConfigurationDialog.primaryPreset')}
                value={form.primaryPresetId}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    primaryPresetId: event.target.value,
                  }))
                }
              >
                {presets.map((preset) => (
                  <MenuItem key={preset.id} value={preset.id}>
                    {preset.title}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label={t('RTKGuardConfigurationDialog.backupPreset')}
                value={form.backupPresetId}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    backupPresetId: event.target.value,
                  }))
                }
              >
                {presets.map((preset) => (
                  <MenuItem key={preset.id} value={preset.id}>
                    {preset.title}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label={t('RTKGuardConfigurationDialog.primaryEcef')}
                value={form.primaryEcef}
                helperText={t('RTKGuardConfigurationDialog.ecefHelp')}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    primaryEcef: event.target.value,
                  }))
                }
              />
              <TextField
                label={t('RTKGuardConfigurationDialog.backupEcef')}
                value={form.backupEcef}
                helperText={t('RTKGuardConfigurationDialog.ecefHelp')}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    backupEcef: event.target.value,
                  }))
                }
              />
            </Box>
            {form.enabled &&
              form.primaryPresetId &&
              activePresetId !== form.primaryPresetId && (
                <Alert
                  severity='warning'
                  action={
                    <Button
                      color='inherit'
                      disabled={activatingPrimary}
                      size='small'
                      onClick={() => void activatePrimary()}
                    >
                      {activatingPrimary
                        ? t('RTKGuardConfigurationDialog.activatingPrimary')
                        : t('RTKGuardConfigurationDialog.activatePrimary')}
                    </Button>
                  }
                >
                  {t('RTKGuardConfigurationDialog.primaryNotActive', {
                    active:
                      presets.find((preset) => preset.id === activePresetId)
                        ?.title ??
                      activePresetId ??
                      t('RTKGuardConfigurationDialog.noActivePreset'),
                  })}
                </Alert>
              )}
            <Alert severity='info'>
              {t('RTKGuardConfigurationDialog.automaticEcef')}
            </Alert>

            <Box
              sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}
            >
              <TextField
                select
                label={t('RTKGuardConfigurationDialog.mode')}
                value={form.mode}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    mode:
                      event.target.value === 'active' ? 'active' : 'dry_run',
                  }))
                }
              >
                <MenuItem value='dry_run'>
                  {t('RTKGuardConfigurationDialog.dryRun')}
                </MenuItem>
                <MenuItem value='active'>
                  {t('RTKGuardConfigurationDialog.active')}
                </MenuItem>
              </TextField>
              <TextField
                type='number'
                label={t('RTKGuardConfigurationDialog.confirmationTimeout')}
                value={form.confirmationTimeout}
                inputProps={{ min: 0.1, step: 0.5 }}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    confirmationTimeout: Number(event.target.value),
                  }))
                }
              />
            </Box>
            <FormControlLabel
              control={
                <Switch
                  checked={form.switchingEnabled}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      switchingEnabled: event.target.checked,
                    }))
                  }
                />
              }
              label={t('RTKGuardConfigurationDialog.autoSwitch')}
            />
            {form.mode === 'active' && form.switchingEnabled && (
              <Alert severity='warning'>
                {t('RTKGuardConfigurationDialog.activeWarning')}
              </Alert>
            )}

            <Accordion disableGutters>
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Typography>
                  {t('RTKGuardConfigurationDialog.advanced')}
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Stack spacing={2}>
                  <Typography variant='subtitle2'>
                    {t('RTKGuardConfigurationDialog.requiredConstellations')}
                  </Typography>
                  <FormGroup row>
                    {CONSTELLATIONS.map((constellation) => (
                      <FormControlLabel
                        key={constellation}
                        control={
                          <Checkbox
                            checked={form.health.required_constellations.includes(
                              constellation
                            )}
                            onChange={(event) =>
                              setForm((current) => ({
                                ...current,
                                health: {
                                  ...current.health,
                                  required_constellations: event.target.checked
                                    ? [
                                        ...current.health
                                          .required_constellations,
                                        constellation,
                                      ]
                                    : current.health.required_constellations.filter(
                                        (item) => item !== constellation
                                      ),
                                },
                              }))
                            }
                          />
                        }
                        label={constellation}
                      />
                    ))}
                  </FormGroup>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={form.health.enable_phase_comparison}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            health: {
                              ...current.health,
                              enable_phase_comparison: event.target.checked,
                            },
                          }))
                        }
                      />
                    }
                    label={t('RTKGuardConfigurationDialog.phaseComparison')}
                  />
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                      gap: 2,
                    }}
                  >
                    {HEALTH_FIELDS.map(({ key, step }) => (
                      <TextField
                        key={key}
                        type='number'
                        label={t(`RTKGuardConfigurationDialog.health.${key}`)}
                        value={form.health[key]}
                        inputProps={{ min: 0, step }}
                        onChange={(event) =>
                          updateHealth(key, Number(event.target.value))
                        }
                      />
                    ))}
                  </Box>
                  <TextField
                    fullWidth
                    label={t('RTKGuardConfigurationDialog.recordingDirectory')}
                    value={form.recordingDirectory}
                    helperText={t(
                      'RTKGuardConfigurationDialog.recordingDirectoryHelp'
                    )}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        recordingDirectory: event.target.value,
                      }))
                    }
                  />
                </Stack>
              </AccordionDetails>
            </Accordion>
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button disabled={saving} onClick={onClose}>
          {t('general.action.cancel')}
        </Button>
        <Button
          variant='contained'
          disabled={loading || saving}
          onClick={() => void save()}
        >
          {saving
            ? t('RTKGuardConfigurationDialog.saving')
            : t('general.action.save')}
        </Button>
      </DialogActions>
    </DraggableDialog>
  );
};

export default RTKGuardConfigurationDialog;
