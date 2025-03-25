import { api, ProviderScope } from '@moosync/edk'

type _OverloadUnion<TOverload, TPartialOverload = unknown> = TPartialOverload & TOverload extends (
    ...args: infer TArgs
) => infer TReturn
    ?
    TPartialOverload extends TOverload
    ? never
    :
    | _OverloadUnion<TOverload, Pick<TOverload, keyof TOverload> & TPartialOverload & ((...args: TArgs) => TReturn)>
    | ((...args: TArgs) => TReturn)
    : never

type OverloadUnion<TOverload extends (...args: any[]) => any> = Exclude<
    _OverloadUnion<
        (() => never) & TOverload
    >,
    TOverload extends () => never ? never : () => never
>

type OverloadParameters<T extends (...args: any[]) => any> = Parameters<OverloadUnion<T>>

type ListenerUnionToObject<T extends [key: string, cb: (...args: any[]) => any]> = {
    [K in T as K[0]]?: K[1]
}

export type MoosyncCommands = ListenerUnionToObject<OverloadParameters<typeof api['on']>>

export type MoosyncResponse<T extends keyof MoosyncCommands> = ReturnType<MoosyncCommands[T]>

/**
 * @deprecated Don't actually use this yet, it's a WIP depending on EDK changes
 */
export function registerCommands(listeners: Omit<MoosyncCommands, 'getProviderScopes'>) {
    const scopes: ProviderScope[] = []
    for (const [_key, cb] of Object.entries(listeners)) {
        const key = _key as keyof MoosyncCommands
        // Thanks typescript
        // @ts-ignore
        api.on(key, cb)

        if (key !== 'handleCustomRequest') {
            // can't actually collect scopes because the naming is cursed
        }
    }
}

export function getSecure<T>(key: string): T {
    const attempt = api.getSecure({ key }) as any

    if (attempt?.value !== undefined && attempt?.value !== null) {
        return attempt.value
    }

    throw new Error(`Secure value ${key} not found`)
}