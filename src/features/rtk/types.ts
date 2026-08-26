import type { Response_RTKSTAT } from '@skybrush/flockwave-spec';
import type { LonLat } from '~/utils/geography';
import type { Coordinate3D } from '~/utils/math';

export enum RTKAntennaPositionFormat {
  LON_LAT = 'lonLat',
  ECEF = 'ecef',
}

export enum RTKCorrectionStatus {
  // We are not connected to the server at all
  NOT_CONNECTED = 'notConnected',

  // No RTK preset is selected
  INACTIVE = 'inactive',

  // We have connected to the RTK base station only recently so the status is not
  // conclusive yet
  CONNECTED_RECENTLY = 'connectedRecently',

  // RTK base station is currently running a survey
  SURVEY_IN_PROGRESS = 'surveyInProgress',

  // RTK base station does not seem to provide correction data for a sufficient number
  // of satellites
  NOT_ENOUGH_SATELLITES = 'notEnoughSatellites',

  // RTK base station has no recent antenna position information message
  NO_ANTENNA_POSITION = 'noAntennaPosition',

  // RTK corrections are sufficiently recent and contain enough satellites
  OK = 'ok',

  // Other unspecified error
  ERROR = 'error',
}

export type RTKSavedCoordinate = {
  position: LonLat;
  positionECEF: Coordinate3D;
  accuracy: number;
  savedAt: number;
};

export type RTKStatistics = {
  /**
   * Timestamp when the statistics was updated the last time,
   * as a UNIX timestamp
   */
  lastUpdatedAt?: number;

  /**
   * Carrier-to-noise ratio for satellites for which we have RTK correction
   * data. Keys are satellite identifiers; each associated value is the
   * corresponding carrier-to-noise ratio and the timestamp.
   */
  satellites: Record<
    string,
    {
      /**
       * UNIX timestamp in milliseconds when this
       * satellite was observed the last time
       */
      lastUpdatedAt: number;

      /** Carrier-to-noise ratio */
      cnr: number;
    }
  >;

  /**
   * RTCM messages recently processed by the server and their bandwidth
   * requirements (inbound and outbound). Keys are RTCM message identifiers;
   * each associated value is the corresponding bandwidth usage and the timestamp.
   */
  messages: Record<
    string,
    {
      /**
       * UNIX timestamp in milliseconds when this
       * message was observed the last time
       */
      lastUpdatedAt: number;

      /**
       * Number of bytes per second that we used to receive RTCM messages of
       * this type.
       */
      bitsPerSecondReceived: number;

      /**
       * Number of bytes per second that we used to forward RTCM messages of
       * this type. undefined if the server did not provide it.
       */
      bitsPerSecondTransferred: number | undefined;
    }
  >;

  /** Information about the antenna position and description */
  antenna: {
    descriptor?: string;
    height?: number;
    position?: LonLat; // should be [lon, lat]
    positionECEF?: Coordinate3D; // should be [x, y, z] integers, in mm
    serialNumber?: string;
    stationId?: number;
  };

  /** Information about the status of the survey process */
  survey: {
    /** Achieved surveying accuracy, in meters */
    accuracy?: number;

    /**
     * Status flags:
     * - bit 0 = survey available
     * - bit 1 = survey in progress
     * - bit 2 = surveyed coordinate valid
     */
    flags?: number;
  };
};

export type RTKStatisticsResponse = Omit<Response_RTKSTAT, 'messages_tx'> & {
  messagesTx: Response_RTKSTAT['messages_tx'];
};

export type RTKGuardSourceStatus = {
  state: 'GOOD' | 'DEGRADED' | 'FAILED' | 'READY' | 'NOT_READY' | 'UNKNOWN';
  reasons: string[];
  msmAge: number | null;
  satellites: number;
  medianCnr: number | null;
};

export type RTKGuardStatus = {
  active: string | null;
  primary: RTKGuardSourceStatus;
  backup: RTKGuardSourceStatus;
  pair: {
    state: 'CONSISTENT' | 'DISAGREE' | 'NOT_COMPARABLE';
    reasons: string[];
    commonSatellites: number;
    commonSignals: number;
    overlap: number;
    phaseOutlierRatio: number | null;
    recent: boolean;
  };
  switch: {
    decision: 'ALLOWED' | 'INHIBITED';
    allowed: boolean;
    automatic: boolean;
    armed: boolean;
    reason: string;
    state: string;
    mode: 'dry_run' | 'active';
  };
};

export type RTKGuardSourceConfiguration = {
  preset_id?: string;
  source?: string;
  expected_ecef?: [number, number, number];
};

export type RTKGuardHealthConfiguration = {
  degraded_msm_age?: number;
  max_msm_age?: number;
  max_position_age?: number;
  maximum_position_error?: number;
  maximum_position_jump?: number;
  minimum_satellites?: number;
  minimum_common_satellites?: number;
  minimum_common_signals?: number;
  required_constellations?: string[];
  primary_failure_hold?: number;
  backup_ready_hold?: number;
  pair_recent_window?: number;
  epoch_tolerance?: number;
  maximum_phase_outlier_ratio?: number;
  phase_mad_multiplier?: number;
  phase_absolute_floor?: number;
  pair_disagreement_hold?: number;
  mass_cycle_slip_count?: number;
  cycle_slip_window?: number;
  minimum_cnr?: number;
  cnr_collapse_delta?: number;
  enable_phase_comparison?: boolean;
};

export type RTKGuardConfiguration = {
  enabled?: boolean;
  mode?: 'dry_run' | 'active';
  primary?: RTKGuardSourceConfiguration;
  backup?: RTKGuardSourceConfiguration;
  health?: RTKGuardHealthConfiguration;
  switching?: {
    enabled?: boolean;
    allow_auto_failback?: false;
    confirmation_timeout?: number;
  };
  recording_directory?: string;
  [key: string]: unknown;
};
