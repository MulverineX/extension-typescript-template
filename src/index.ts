import { Artist, Song, api } from '@moosync/edk'
import { Logger } from './util'
import { MusicbrainzAPI } from './musicbrainzApi'
import { MoosyncCommands, MoosyncResponse } from './util/extension'

class SampleExtension {
  private Logger = Logger('Sample Extension')

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

  public async getArtistSongs(artist: Artist): Promise<MoosyncResponse<'getArtistSongs'>> {
    this.Logger.debug('Responding to event command getArtistSongs', JSON.stringify(artist))

    const artistId = artist[0].artist_id.replace('moosync.starter:', '')
    const songs = await this.musicbrainzApi.getArtistSongs(artistId, false)
    return { songs }
  }

  public async getSongFromUrl(url: string): Promise<MoosyncResponse<'getSongFromUrl'>> {
    this.Logger.debug('Responding to event command getSongFromUrl')

    const song = (await this.musicbrainzApi.parseUrl(url, false)) as unknown as Song

    /* @ts-ignore */
    // this.Logger.debug((new Set()).intersection) // TODO: More typescript being weird
    if (song) return { song }
  }

  public async handleCustomRequest(url: string): Promise<MoosyncResponse<'handleCustomRequest'>> {
    this.Logger.debug('Responding to event command handleCustomRequest')

    try {
      this.Logger.debug('got stream request', url, typeof this.musicbrainzApi.getSongDetailsById)
      const redirectUrl = await this.musicbrainzApi.getSongStreamById(new URL(url).pathname.substring(1), false)
      this.Logger.debug('got direct url', redirectUrl)
      return { redirectUrl }
    } catch (e) {
      this.Logger.error('Error handling custom request', e, url)
    }
  }

  public getProviderScopes(): MoosyncResponse<'getProviderScopes'> {
    this.Logger.debug('Responding to event command getProviderScopes')
    return ['artistSongs', 'songFromUrl']
  }

  public registerListeners() {
    const listeners: (keyof MoosyncCommands)[] = ['getProviderScopes', 'getArtistSongs', 'getSongFromUrl', 'handleCustomRequest']

    for (const listener of listeners) {
      /* @ts-ignore */
      api.on(listener, this[listener].bind(this))
    }
  }
}

export function entry() {
  const ext = new SampleExtension()
  ext.registerListeners()
}

if (globalThis.module !== undefined && module.exports !== undefined) {
  module.exports = {
    ...module.exports,
    ...require('@moosync/edk').Exports
  }
}