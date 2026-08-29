type FlagState = [boolean, (value: boolean) => void]

export function useRegisterSW(): {
  offlineReady: FlagState
  needRefresh: FlagState
  updateServiceWorker: () => Promise<void>
} {
  return {
    offlineReady: [false, () => undefined],
    needRefresh: [false, () => undefined],
    updateServiceWorker: async () => undefined,
  }
}
