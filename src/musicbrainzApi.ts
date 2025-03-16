import { api, Artist, Song } from '@moosync/edk'
import { IsoDate } from '@kellnerd/musicbrainz/common-types'
import { $Artist as MBArtist, MinimalRecording as MBSong, $Recording } from '@kellnerd/musicbrainz/api-types'
import { _fetch, Logger } from './util'

export class MusicbrainzAPI {
  private Logger = Logger('Musicbrainz API')

  private BASE_URL?: string

  constructor(private updateBaseUrlCallback: (key: string) => Promise<void>) {}

  public getBaseUrl(baseUrl?: string) {
    if (!baseUrl) {
      this.Logger.info('setting base url')
      baseUrl = 'https://beta.musicbrainz.org/ws/'
    }

    this.Logger.info('setting base url', baseUrl)
    this.BASE_URL = baseUrl
    this.updateBaseUrlCallback(baseUrl)
  }

  private async get<T>(
    path: string,
    params: Record<string, string>,
    invalidateCache: boolean,
    maxTries = 0
  ): Promise<T | undefined> {
    if (!this.BASE_URL) {
      this.getBaseUrl()
    }

    const parsedParams = new URLSearchParams(params)
    const parsedUrl = new URL(this.BASE_URL + path + '?fmt=json&' + parsedParams.toString())
    // const cache = this.cacheHandler.getParsedCache<T>(parsedUrl.toString())
    // if (cache && !invalidateCache) {
    // return cache
    // }

    try {
      const raw = await _fetch(parsedUrl)
      this.Logger.info('raw', parsedUrl)
      const resp = JSON.parse(await raw.text())
      // this.cacheHandler.addToCache(url.toString(), resp)
      return resp
    } catch (e) {
      console.error('Error fetching URL', parsedUrl, e)
    }
  }

  public async parseUrl(url: string, invalidateCache: boolean) {
    if (url.startsWith('https://beta.musicbrainz.org/')) {
      if (url.includes('/recording/')) {
        const id = url.split('/recording/')[1]
        return this.getSongDetailsById(id, invalidateCache)
      }
    }
  }

  public async getSongStreamById(id: string, invalidateCache: boolean) {
    // const cache = this.cacheHandler.getCache(`song:${id}`)
    let streamURL: string | undefined = ''
    // if (cache) {
    //   streamURL = cache
    // }
    streamURL = undefined

    this.Logger.info('finding url')
    if (!streamURL) {
      streamURL = this.findStreamURL()
      // this.cacheHandler.addToCache(`song:${id}`, streamURL)
    }

    return streamURL
  }

  private findStreamURL(/*track: MBSong */) {
    const streamUrl = 'https://github.com/rafaelreis-hotmart/Audio-Sample-files/raw/master/sample.mp3'

    return streamUrl
  }

  private parseArtists(...artists: MBArtist[]): Artist[] {
    const ret = []
    for (const data of artists) {
      ret.push({
        artist_id: data.id,
        artist_name: data.name,
      })
    }

    return ret
  }

  public async searchArtist(artist_name: string, invalidateCache: boolean) {
    try {
        /// query=artist:fred%20AND%20type:group%20AND%20country:US
      const data = await this.get<{ artists: MBArtist[]}>(
        'search',
        {
          limit: '20',
          query: `artist:${artist_name}`
        },
        invalidateCache
      )

      return this.parseArtists(...data.artists)
    } catch (e) {
      console.error(e)
    }
  }

  private parseISODate(s: IsoDate) {
    var b = s.split('-');
    if (b.length === 1) {
        return new Date(Date.UTC(Number(b[0])))
    } else if (b.length === 2) {
        return new Date(Date.UTC(Number(b[0]), Number(b[1]) - 1))
    } else {
        return new Date(Date.UTC(Number(b[0]), Number(b[1]) - 1, Number(b[2])))
    }
  }

  private async parseSongs(invalidateCache: boolean, ...tracks: MBSong[]) {
    const songs: Song[] = []

    for (let t of tracks) {
      // this.cacheHandler.addToCache(`song:${t.id}`, streamUrl)
      songs.push({
        _id: t.id.toString(),
        title: t.title,
        duration: t.length / 1000,
        url: `https://beta.musicbrainz.org/recording/${t.id}`,
        playbackUrl: `extension://moosync.starter/${t.id}`,
        date_added: Date.now(),
        date: t['first-release-date'], // this.parseISODate(t['first-release-date']) not sure what kind of date format this is supposed to be, nice docs Oveno
        genre: [], // Recording genres is a scoped value
        artists: (t['artist-credit'] as unknown as typeof t['artist-credit']['__data__']).map(({ artist }) => ({
          artist_id: `musicbrainz:artist:${artist.id}`,
          artist_name: artist.name,
        })),
        type: 'URL'
      })
    }

    return songs
  }

  public async getArtistSongs(id: string, invalidateCache: boolean) {
    const tracks: Song[] = []

    let params = {
      inc: 'recordings'
    }

    const data = await this.get<MBArtist<'recordings'>>(`artist/${id}`, params, invalidateCache)

    const songs = await this.parseSongs(invalidateCache, ...(data['recordings'] as unknown as MBArtist<'recordings'>['recordings']['__data__']))
    tracks.push(...songs)

    return tracks
  }

  public async getSongDetailsById(id: string, invalidateCache: boolean): Promise<Song> {
    // const cache = this.cacheHandler.getCache(`songDets:${id}`)
    // if (cache && !invalidateCache) {
    // return JSON.parse(cache)
    // }

    const trackDetails = await this.get<$Recording<'genres'>>(`recording/${id}`, { inc: 'genres' }, invalidateCache)
    // this.cacheHandler.addToCache(`songDets:${id}`, JSON.stringify(trackDetails))
    return {
        _id: trackDetails.id,
        title: trackDetails.title,
        duration: trackDetails.length / 1000,
        url: `https://beta.musicbrainz.org/recording/${trackDetails.id}`,
        playbackUrl: `extension://moosync.starter/${trackDetails.id}`,
        date_added: Date.now(),
        date: trackDetails['first-release-date'], // this.parseISODate(t['first-release-date']) not sure what kind of date format this is supposed to be, nice docs Oveno,
        genre: (trackDetails.genres as unknown as { name: string}[]).map(({ name }) => name),
        artists: (trackDetails['artist-credit'] as unknown as typeof trackDetails['artist-credit']['__data__']).map(({ artist }) => ({
            artist_id: `musicbrainz:artist:${artist.id}`,
            artist_name: artist.name,
        })),
        type: 'URL'
      }
  }
}
