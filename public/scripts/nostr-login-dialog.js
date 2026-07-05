/* eslint-disable no-undef */

class NostrLoginDialog extends Dialog {

    constructor() {
        super('nostr-login-dialog');

        this.$list = this.$el.querySelector('.nostr-login-methods');
        this._resolve = null;
        globalThis.meshdropNostrLoginDialog = this;
    }

    choose(methods) {
        this.$list.replaceChildren(...methods.map(method => this._methodButton(method)));
        this.show();

        return new Promise(resolve => {
            this._resolve = resolve;
        });
    }

    _methodButton(method) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'transport-choice-option nostr-login-method';
        button.dataset.method = method.id;

        const head = document.createElement('span');
        head.className = 'transport-choice-head';

        const label = document.createElement('span');
        label.className = 'transport-choice-label';
        label.textContent = method.label;

        const description = document.createElement('span');
        description.className = 'transport-choice-description';
        description.textContent = method.description;

        head.append(label);
        button.append(head, description);
        button.addEventListener('click', _ => this._select(method.id));
        return button;
    }

    _select(method) {
        const resolve = this._resolve;
        this._resolve = null;
        this.hide();
        resolve?.(method);
    }

    hide() {
        const resolve = this._resolve;
        this._resolve = null;
        super.hide();
        resolve?.(null);
    }
}

globalThis.NostrLoginDialog = NostrLoginDialog;
