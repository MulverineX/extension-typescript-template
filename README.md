# Moosync Extension boilerplate

## Quick Overview

This is a minimal starter app that benefits of the strong typing of the Typescript compiler plus all the latest ES6, ES7+ features.


## Usage

## Installation

Clone the repository then:

``` bash
bun install
```

To install all dependencies.

## Writing code

Custom types should be defined under `src/types`

Functionality of the extension can be implemented in `src/index.ts`

### Package details

Details of the package can be changed inside `package.json`

#### Inside `package.json`

**name** is the unique package name of the extension. Can not contain whitespace.

**version** is the version of the extension.

**moosyncExtension** is the file which is read when extension is loaded in Moosync.

**displayName** is the Name of the extension. May contain whitespace.

**author** is the name of the author of the extension.

## Extension Lifecycle

The extension system in Moosync makes use of Event Commands to listener functions.

### Event Commands

**Available event commands can be found [here](https://moosync.app/extensions-sdk/wasm-extension-js/docs/interfaces/ExtensionAPI.html#on)**

The basic event commands for Streaming extensions are:

- getProviderScopes: Fired when extension is started, defines which Event Commands the extension will accept from the client.
- songFromUrl: Fired when a user sends a URL to the app to resolve and begin playback on.

It is recommended to create an instance of your required code inside your entry function.

Example for implementation of most Streaming extension events can be found [here](https://github.com/Moosync/moosync-exts/blob/d66620dff2301c4205eb5695a52999da64f5ec52/soundcloud/src/index.ts).

### API

You may also make use of the on demand API to fetch data from Moosync.

Documentation for the API can be found [here](https://moosync.app/extensions-sdk/wasm-extension-js/docs/interfaces/ExtensionAPI.html).

## Creating the extension

To Build and pack the extension for Moosync using [extism-js](https://github.com/extism/js-pdk#install-script) & [Moosync packer](https://github.com/Moosync/extension-packer)

``` bash
bun run build
```

To test how your extension responds to Event Commands you can use [moodriver](https://github.com/Moosync/moodriver) to setup a test harness.
For now requires Rust/Cargo be available to build/install the CLI.

A testing script and sample test is provided in this template. Note: an extension output (log) is required for tests to pass

```bash
bun run test
```