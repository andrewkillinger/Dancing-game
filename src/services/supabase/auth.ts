import { getSupabaseClient } from './client';
import { PlayerProfile, CustomizationData, DEFAULT_CUSTOMIZATION } from '@/types';

// ─── Local Storage Keys ───────────────────────────────────────────────────────

const LOCAL_PROFILE_KEY = 'wobble_dance_profile';

function loadLocalProfile(): PlayerProfile {
  try {
    const raw = localStorage.getItem(LOCAL_PROFILE_KEY);
    if (raw) return JSON.parse(raw) as PlayerProfile;
  } catch {
    // ignore
  }
  return {
    id: `guest_${Date.now()}`,
    displayName: 'Wobbler',
    customization: { ...DEFAULT_CUSTOMIZATION },
    lastSeen: new Date().toISOString(),
    isGuest: true,
  };
}

function saveLocalProfile(profile: PlayerProfile): void {
  localStorage.setItem(LOCAL_PROFILE_KEY, JSON.stringify(profile));
}

// ─── Auth Service ─────────────────────────────────────────────────────────────

export class AuthService {
  private _profile: PlayerProfile | null = null;

  async init(): Promise<PlayerProfile> {
    const supabase = getSupabaseClient();

    if (!supabase) {
      // Guest mode - load from localStorage
      this._profile = loadLocalProfile();
      return this._profile;
    }

    try {
      // Try anonymous sign-in if no session
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        const { data, error } = await supabase.auth.signInAnonymously();
        if (error) throw error;
        if (!data.session) throw new Error('No session after anonymous sign in');
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user');

      // Load or create profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileData) {
        this._profile = {
          id: profileData.id,
          displayName: profileData.display_name ?? 'Wobbler',
          customization: (profileData.customization_json as CustomizationData) ?? { ...DEFAULT_CUSTOMIZATION },
          lastSeen: profileData.last_seen ?? new Date().toISOString(),
          isGuest: user.is_anonymous ?? true,
        };
      } else {
        // Create new profile
        const newProfile: PlayerProfile = {
          id: user.id,
          displayName: 'Wobbler',
          customization: { ...DEFAULT_CUSTOMIZATION },
          lastSeen: new Date().toISOString(),
          isGuest: user.is_anonymous ?? true,
        };

        await supabase.from('profiles').insert({
          id: user.id,
          display_name: newProfile.displayName,
          customization_json: newProfile.customization,
          last_seen: newProfile.lastSeen,
        });

        this._profile = newProfile;
      }

      // Update last_seen
      await supabase
        .from('profiles')
        .update({ last_seen: new Date().toISOString() })
        .eq('id', user.id);

    } catch (err) {
      console.warn('[Auth] Falling back to guest mode:', err);
      this._profile = loadLocalProfile();
    }

    // _profile is guaranteed to be set by this point
    return this._profile as PlayerProfile;
  }

  get profile(): PlayerProfile | null {
    return this._profile;
  }

  async signInWithEmail(email: string): Promise<{ error: string | null }> {
    const supabase = getSupabaseClient();
    if (!supabase) return { error: 'Supabase not configured' };

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.href },
      });
      return { error: error?.message ?? null };
    } catch (err) {
      return { error: String(err) };
    }
  }

  async signOut(): Promise<void> {
    const supabase = getSupabaseClient();
    if (supabase) {
      await supabase.auth.signOut();
    }
    // Reset to guest
    this._profile = loadLocalProfile();
  }

  async updateProfile(updates: Partial<Pick<PlayerProfile, 'displayName' | 'customization'>>): Promise<void> {
    if (!this._profile) return;

    this._profile = { ...this._profile, ...updates };

    const supabase = getSupabaseClient();
    if (supabase && !this._profile.isGuest) {
      try {
        await supabase.from('profiles').update({
          display_name: this._profile.displayName,
          customization_json: this._profile.customization,
        }).eq('id', this._profile.id);
      } catch (err) {
        console.warn('[Auth] Failed to sync profile:', err);
      }
    } else {
      // Guest fallback
      saveLocalProfile(this._profile);
    }
  }

  isLoggedIn(): boolean {
    return Boolean(this._profile && !this._profile.isGuest);
  }
}

export const authService = new AuthService();
