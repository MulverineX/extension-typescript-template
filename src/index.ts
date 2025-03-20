import { Artist, Song, api } from '@moosync/edk'
import { Logger, registerCommands } from './util'
import { MusicbrainzAPI } from './musicbrainzApi'

class SampleExtension {
  Logger = Logger('Sample Extension')

  constructor() {
    this.Logger.info('Initializing...')
  }

  private musicbrainzApi = new MusicbrainzAPI(this.updateBaseUrl.bind(this))

  private updateBaseUrl(key: string) {
    api.setSecure({ key: 'BASE_URL', value: key })
  }

  // Stub function for now
  private fetchPreferences() {
    const baseUrl = api.getSecure<string>({ key: 'BASE_URL' })
    this.musicbrainzApi.getBaseUrl(baseUrl)
  }

  registerListeners() {
    api.on('getProviderScopes', () => {
      this.Logger.debug('Responding to event command getProviderScopes')
      return [
        'artistSongs',
        'songFromUrl',
      ]
    })

    api.on('getArtistSongs', async (artist: Artist) => {
      this.Logger.debug('Responding to event command getArtistSongs', JSON.stringify(artist))

      const artistId = artist[0].artist_id.replace('moosync.starter:', '')
      const songs = await this.musicbrainzApi.getArtistSongs(artistId, false)
      return { songs }
    })

    api.on('getSongFromUrl', async (url) => {
      this.Logger.debug('Responding to event command getSongFromUrl')

      const song = (await this.musicbrainzApi.parseUrl(url, false)) as unknown as Song
      if (song) return { song }
    })

    api.on('handleCustomRequest', async (url) => {
      this.Logger.debug('Responding to event command handleCustomRequest')

      try {
        this.Logger.debug('got stream request', url)
        const redirectUrl = await this.musicbrainzApi.getSongStreamById(new URL(url).pathname.substring(1), false)
        this.Logger.debug('got direct url', redirectUrl)
        return { redirectUrl }
      } catch (e) {
        this.Logger.error('Error handling custom request', e, url)
      }
    })
  }
}

export function entry() {
  const ext = new SampleExtension()
  ext.registerListeners()
}

if (Object.hasOwn(globalThis, 'module') && module.exports) {
  module.exports = {
    ...module.exports,
    ...require('@moosync/edk').Exports
  }
}