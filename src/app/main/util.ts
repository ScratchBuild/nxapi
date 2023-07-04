import { BrowserWindow, dialog, Menu, MenuItem, MessageBoxOptions, nativeImage } from './electron.js';
import path from 'node:path';
import { Buffer } from 'node:buffer';
import fetch from 'node-fetch';
import { dir } from '../../util/product.js';
import { App, Store } from './index.js';
import { SavedToken } from '../../common/auth/coral.js';
import { ErrorDescription } from '../../util/errors.js';

export const bundlepath = path.resolve(dir, 'dist', 'app', 'bundle');

export async function getNativeImageFromUrl(url: URL | string, useragent?: string) {
    const response = await fetch(url.toString(), {
        headers: {
            'User-Agent': useragent ?? '',
        },
    });
    const image = await response.arrayBuffer();
    return nativeImage.createFromBuffer(Buffer.from(image));
}

export async function tryGetNativeImageFromUrl(url: URL | string, useragent?: string) {
    try {
        return await getNativeImageFromUrl(url, useragent);
    } catch (err) {}

    return undefined;
}

export async function askUserForUri(store: Store, uri: string, prompt: string): Promise<[string, SavedToken] | null> {
    const menu = new Menu();

    const ids = await store.storage.getItem('NintendoAccountIds') as string[] | undefined;
    menu.append(new MenuItem({label: prompt, enabled: false}));
    menu.append(new MenuItem({label: uri, enabled: false}));
    menu.append(new MenuItem({type: 'separator'}));

    let selected_user: [string, SavedToken] | null = null;

    const items = await Promise.all(ids?.map(async id => {
        const token = await store.storage.getItem('NintendoAccountToken.' + id) as string | undefined;
        if (!token) return;
        const data = await store.storage.getItem('NsoToken.' + token) as SavedToken | undefined;
        if (!data) return;

        return new MenuItem({
            label: data.nsoAccount.user.name,
            click: (menuItem, browserWindow, event) => {
                selected_user = [token, data];
                menu.closePopup(browserWindow);
            },
        });
    }) ?? []);

    if (!items.length) return null;

    for (const item of items) if (item) menu.append(item);
    menu.append(new MenuItem({type: 'separator'}));
    menu.append(new MenuItem({label: 'Cancel', click: (i, w) => menu.closePopup(w)}));

    const window = new BrowserWindow({show: false});
    // Add a delay to prevent the menu being closed immediately
    await new Promise(rs => setTimeout(rs, 100));
    await new Promise<void>(rs => menu.popup({callback: rs}));
    window.destroy();

    return selected_user;
}

interface ErrorBoxOptions extends MessageBoxOptions {
    error: Error | unknown;
    app?: App;
    window?: BrowserWindow;
}

export function showErrorDialog(options: ErrorBoxOptions) {
    const {error, app, window, ...message_box_options} = options;
    const detail = ErrorDescription.getErrorDescription(error);

    message_box_options.detail = message_box_options.detail ?
        detail + '\n\n' + message_box_options.detail :
        detail;

    if (!message_box_options.type) message_box_options.type = 'error';

    return window ?
        dialog.showMessageBox(window, message_box_options) :
        dialog.showMessageBox(message_box_options);
}
