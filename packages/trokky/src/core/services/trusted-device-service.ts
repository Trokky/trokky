import { InvalidInputError } from '../errors/index.js'
import type { TrokkyLogger } from '../utils/logger.js'
import type { SettingsConfig, TrustedDevice, UpdateUserData, User } from '../types/index.js'

export interface TrustedDeviceServiceDependencies {
  logger: TrokkyLogger
  getUser: (id: string) => Promise<User | null>
  updateUser: (id: string, userData: UpdateUserData) => Promise<User>
  getSettings: () => Promise<SettingsConfig | null>
}

/**
 * Trusted device management for MFA bypass.
 */
export class TrustedDeviceService {
  constructor(private readonly deps: TrustedDeviceServiceDependencies) {}

  /**
   * Trust a device to skip MFA
   */
  public async trustDevice(
    userId: string,
    deviceId: string,
    deviceName: string,
    options?: { ipAddress?: string; userAgent?: string }
  ): Promise<TrustedDevice> {
    const user = await this.deps.getUser(userId)
    if (!user) {
      throw new InvalidInputError('User not found', 'userId')
    }

    // Get trust duration from settings
    const settings = await this.deps.getSettings()
    const trustDays = settings?.mfaTrustDeviceDays ?? 30

    const trustedDevice: TrustedDevice = {
      id: deviceId,
      name: deviceName,
      trustedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + trustDays * 24 * 60 * 60 * 1000).toISOString(),
      lastUsedAt: new Date().toISOString(),
      ipAddress: options?.ipAddress,
      userAgent: options?.userAgent
    }

    const currentDevices = user.mfa?.trustedDevices || []
    // Remove existing device with same ID if present
    const otherDevices = currentDevices.filter(d => d.id !== deviceId)

    await this.deps.updateUser(userId, {
      mfa: {
        ...user.mfa!,
        trustedDevices: [...otherDevices, trustedDevice]
      }
    } as UpdateUserData)

    this.deps.logger.info('Device trusted', { userId, deviceId, deviceName })

    return trustedDevice
  }

  /**
   * Check if a device is trusted for MFA bypass
   */
  public async isDeviceTrusted(userId: string, deviceId: string): Promise<boolean> {
    const user = await this.deps.getUser(userId)
    if (!user) {
      return false
    }

    const device = user.mfa?.trustedDevices?.find(d => d.id === deviceId)
    if (!device) {
      return false
    }

    // Check if trust has expired
    if (new Date(device.expiresAt) < new Date()) {
      // Clean up expired device
      const updatedDevices = (user.mfa?.trustedDevices || []).filter(d => d.id !== deviceId)
      await this.deps.updateUser(userId, {
        mfa: {
          ...user.mfa!,
          trustedDevices: updatedDevices
        }
      } as UpdateUserData)
      return false
    }

    // Update last used time
    const updatedDevices = (user.mfa?.trustedDevices || []).map(d =>
      d.id === deviceId ? { ...d, lastUsedAt: new Date().toISOString() } : d
    )
    await this.deps.updateUser(userId, {
      mfa: {
        ...user.mfa!,
        trustedDevices: updatedDevices
      }
    } as UpdateUserData)

    return true
  }

  /**
   * Revoke trust for a specific device
   */
  public async revokeTrustedDevice(userId: string, deviceId: string): Promise<void> {
    const user = await this.deps.getUser(userId)
    if (!user) {
      throw new InvalidInputError('User not found', 'userId')
    }

    const updatedDevices = (user.mfa?.trustedDevices || []).filter(d => d.id !== deviceId)

    await this.deps.updateUser(userId, {
      mfa: {
        ...user.mfa!,
        trustedDevices: updatedDevices
      }
    } as UpdateUserData)

    this.deps.logger.info('Device trust revoked', { userId, deviceId })
  }

  /**
   * Revoke trust for all devices
   */
  public async revokeAllTrustedDevices(userId: string): Promise<void> {
    const user = await this.deps.getUser(userId)
    if (!user) {
      throw new InvalidInputError('User not found', 'userId')
    }

    await this.deps.updateUser(userId, {
      mfa: {
        ...user.mfa!,
        trustedDevices: []
      }
    } as UpdateUserData)

    this.deps.logger.info('All device trust revoked', { userId })
  }

  /**
   * Get list of trusted devices for a user
   */
  public async getTrustedDevices(userId: string): Promise<TrustedDevice[]> {
    const user = await this.deps.getUser(userId)
    if (!user) {
      throw new InvalidInputError('User not found', 'userId')
    }

    // Filter out expired devices
    const now = new Date()
    const validDevices = (user.mfa?.trustedDevices || []).filter(
      d => new Date(d.expiresAt) > now
    )

    return validDevices
  }
}
