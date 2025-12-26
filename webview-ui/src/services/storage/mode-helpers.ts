import type { ApiSettings, ModeModelSettings, Provider } from '../../types/api-settings';
import type { ChatMode } from '../../types/chat-mode';

/**
 * Helper functions for managing mode-specific settings.
 * Separates business logic from storage mechanism.
 */
export class ModeHelpers {
  /**
   * Get the provider and model for a specific chat mode.
   * Falls back to global provider/model if no mode-specific setting exists.
   */
  static getModeModel(settings: ApiSettings, mode: ChatMode): ModeModelSettings {
    const modeSettings = settings.modeModelSettings?.[mode];
    
    if (modeSettings) {
      return modeSettings;
    }
    
    // Special handling for YOLO mode: always default to Autodetect
    // The Autodetect option will show as empty/unselected if underlying models are not configured
    if (mode === 'yolo') {
      return {
        provider: 'auto',
        model: 'Autodetect'
      };
    }
    
    // Fallback to global provider/model (inherits current selection)
    return {
      provider: settings.provider,
      model: settings.model,
    };
  }

  /**
   * Create updated settings object with new mode configuration.
   * Does NOT mutate the input settings.
   */
  static updateModeModel(
    settings: ApiSettings,
    mode: ChatMode,
    provider: Provider,
    model: string
  ): ApiSettings {
    // Update ONLY the mode-specific settings using spread to ensure immutability
    const modeModelSettings = {
      ...(settings.modeModelSettings || {}),
      [mode]: { provider, model }
    };
    
    return {
      ...settings,
      modeModelSettings,
    };
  }
}