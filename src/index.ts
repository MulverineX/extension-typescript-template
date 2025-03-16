import { Artist, Song, api } from '@moosync/edk'
import { Logger } from './util'
import { MusicbrainzAPI } from './musicbrainzApi'

class SampleExtension {
  Logger = Logger('Sample Extension')

  constructor() {
    this.Logger.info('Initializing')
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
      return [
        'artistSongs',
        'songFromUrl',
      ]
    })

    api.on('getArtistSongs', async (artist: Artist) => {
      const musicbrainzArtist = (await this.musicbrainzApi.searchArtist(artist.artist_name, false))[0]
      if (musicbrainzArtist) {
        // TODO
        const artistId = musicbrainzArtist.artist_id.replace('soundcloud:users:', '')
        const songs = await this.musicbrainzApi.getArtistSongs(artistId, false)
        return { songs }
      }

      return {
        songs: []
      }
    })

    api.on('getSongFromUrl', async (url) => {
      const song = (await this.musicbrainzApi.parseUrl(url, false)) as unknown as Song
      if (song) return { song }
    })

    api.on('handleCustomRequest', async (url) => {
      try {
        console.log('got stream request', url)
        const redirectUrl = await this.musicbrainzApi.getSongStreamById(new URL(url).pathname.substring(1), false)
        console.log('got direct url', redirectUrl)
        return { redirectUrl }
      } catch (e) {
        console.error(e, url)
      }
    })
  }
}

export function entry() {
  const ext = new SampleExtension()
  ext.registerListeners()
}

module.exports = {
  ...module.exports,
  ...require('@moosync/edk').Exports
}
