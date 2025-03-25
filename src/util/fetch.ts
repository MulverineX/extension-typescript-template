import { Logger } from './logger'

export const _fetch = async (url: string | URL, options?: RequestInit) => {
    const extismOptions: Parameters<typeof Http['request']>[0] = {
        url: typeof url === 'string' ? url : url.toString(),
        method: 'GET'
    }
    if (options) {
        if (options.headers) {
            // Warning: if a library you're trying to use uses Class instances in its headers, this will break. If you make a serializer for this, please consider contributing back to the template.
            extismOptions.headers = options.headers as Record<string, string | number | boolean>
        }
        if (options.method) {
            // Blame Nodejs & Bun for not having a fucking request type literal
            extismOptions.method = options.method as typeof extismOptions.method
        }
        // If you need more request options, they'll either have to serialize into the headers or be PR'd into extism's Http.request API.
    }
    return formRequest(extismOptions.url, Http.request(extismOptions))
}

function formRequest(url: string, resp: ReturnType<typeof Http['request']>): Response {
    const logger = Logger('JS Fetch Stub')

    const success = `${resp.status}`.charAt(0) === '2'
    
    const response: Response = {
        // Fully supported methods.
        text: async () => resp.body,
        json: async () => JSON.parse(resp.body),
        status: resp.status,
        ok: success,
        clone: () => formRequest(url, resp),
        url,

        // Partially supported methods.
        blob: async () => {
            logger.error('Blob not supported by extism.')
            return {} as Blob
        },
        arrayBuffer: async () => {
            logger.error('Binary request response not supported by extism.')
            return {} as ArrayBuffer
        },
        formData: async () => {
            logger.error('XML parser not implemented')
            return {} as FormData
        },
        // TODO: Library might expect a ReadableStream as per spec.
        // Will have issues if the response is not a UTF-8 string.
        body: resp.body as unknown as ReadableStream<any>,
        bodyUsed: false,
        // extism doesn't give us this information for any of these.
        redirected: false,
        statusText: 'OK',
        type: 'basic',
        headers: {} as Headers, // TODO: Add spec-persistent headers from the request.
    }
    if (!success) {
        // @ts-ignore
        response.statusText = resp.body
        // @ts-ignore // TODO: More Typescript being weird
        throw new Error(`Request failed with status ${resp.status}`, {
            cause: response
        })
    }
    return response
}