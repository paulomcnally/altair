import { Component, ViewChild } from '@angular/core';
import { Store } from '@ngrx/store';
import { Observable } from 'rxjs/Observable';
import { TranslateService } from '@ngx-translate/core';
import { ElectronService } from 'ngx-electron';

import isElectron from '../../utils/is_electron';

import * as fromRoot from '../../reducers';
import * as fromHeader from '../../reducers/headers/headers';
import * as fromVariable from '../../reducers/variables/variables';
import * as fromSettings from '../../reducers/settings/settings';

import * as queryActions from '../../actions/query/query';
import * as headerActions from '../../actions/headers/headers';
import * as variableActions from '../../actions/variables/variables';
import * as dialogsActions from '../../actions/dialogs/dialogs';
import * as layoutActions from '../../actions/layout/layout';
import * as docsActions from '../../actions/docs/docs';
import * as windowsActions from '../../actions/windows/windows';
import * as windowsMetaActions from '../../actions/windows-meta/windows-meta';
import * as settingsActions from '../../actions/settings/settings';

import { QueryService } from '../../services/query.service';
import { GqlService } from '../../services/gql.service';
import { WindowService } from '../../services/window.service';

import config from '../../config';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
})
export class AppComponent {
  windowIds$: Observable<any[]>;
  settings$: Observable<fromSettings.State>;

  windowIds = [];
  windowsArr = [];
  activeWindowId = '';
  isElectron = isElectron;
  isReady = false; // determines if the app is fully loaded. Assets, translations, etc.

  constructor(
    private windowService: WindowService,
    private store: Store<any>,
    private translate: TranslateService,
    private electron: ElectronService
  ) {
    this.settings$ = this.store.select('settings').distinctUntilChanged();

    this.setDefaultLanguage();
    this.setAvailableLanguages();

    const applicationLanguage = this.getAppLanguage();
    this.translate.use(applicationLanguage).subscribe(() => {
      this.isReady = true;
    });

    // Update the app translation if the language settings is changed.
    // TODO: Consider moving this into a settings effect.
    this.settings$
      .map(settings => settings.language)
      .filter(x => !!x)
      .distinctUntilChanged()
      .subscribe(language => {
        this.translate.use(language);
      });

    if (this.electron.isElectronApp) {
      this.electron.ipcRenderer.on('create-tab', () => {
        this.newWindow();
      });
      this.electron.ipcRenderer.on('close-tab', () => {
        if (this.windowIds.length > 1) {
          this.removeWindow(this.activeWindowId);
        }
      });
    }

    this.windowIds$ = this.store.select('windows').map(windows => {
      return Object.keys(windows);
    });
    this.store
      .subscribe(data => {
        this.windowIds = Object.keys(data.windows);
        console.log(data.windows, this.windowIds);
        this.windowsArr = this.windowIds.map(id => data.windows[id]);
        this.activeWindowId = data.windowsMeta.activeWindowId;

        // If the active window has not been set, default it
        if (this.windowsArr.length && (!this.activeWindowId || !data.windows[this.activeWindowId])) {
          this.store.dispatch(new windowsMetaActions.SetActiveWindowIdAction({ windowId: this.windowIds[0] }));
        }
      });

    if (!this.windowsArr.length) {
      this.windowService.newWindow();
    }
  }

  /**
   * Sets the default language from config
   */
  setDefaultLanguage(): void {
    const defaultLanguage = config.default_language;
    this.translate.setDefaultLang(defaultLanguage);
  }

  /**
   * Sets the available languages from config
   */
  setAvailableLanguages(): void {
    const availableLanguages = Object.keys(config.languages);
    this.translate.addLangs(availableLanguages);
  }

  /**
   * Checks if the specified language is available
   * @param language Language code
   */
  checkLanguageAvailability(language: string): boolean {
    return this.translate.getLangs().includes(language);
  }

  /**
   * Gets the language to use for the app
   */
  getAppLanguage(): string {
    const defaultLanguage = this.translate.getDefaultLang();
    const clientLanguage = this.translate.getBrowserLang();
    const isClientLanguageAvailable = this.checkLanguageAvailability(clientLanguage);

    return isClientLanguageAvailable ? clientLanguage : defaultLanguage;
  }

  newWindow() {
    this.windowService.newWindow();
  }

  setActiveWindow(windowId) {
    this.store.dispatch(new windowsMetaActions.SetActiveWindowIdAction({ windowId }));
  }

  removeWindow(windowId) {
    this.windowService.removeWindow(windowId);
  }

  setWindowName(data) {
    const { windowId, windowName } = data;
    this.store.dispatch(new layoutActions.SetWindowNameAction(windowId, windowName));
  }

  showSettingsDialog() {
    this.store.dispatch(new settingsActions.ShowSettingsAction());
  }

  hideSettingsDialog() {
    this.store.dispatch(new settingsActions.HideSettingsAction());
  }

  onThemeChange(theme) {
    this.store.dispatch(new settingsActions.SetThemeAction({ value: theme }));
  }

  onLanguageChange(language) {
    this.store.dispatch(new settingsActions.SetLanguageAction({ value: language }));
  }

  /**
   * Transform an object into an array
   * @param obj
   */
  objToArr(obj: any) {
    const arr = [];

    // Convert any object created with the dict pattern (Object.create(null)) to a regular object
    const _obj = Object.assign({}, obj);

    for (const key in _obj) {
      if (_obj.hasOwnProperty(key)) {
        arr.push(_obj[key]);
      }
    }

    return arr;
  }

  externalLink(e, url) {
    e.preventDefault();

    // If electron app
    if (window['process'] && window['process'].versions['electron']) {
      const electron = window['require']('electron');
      electron.shell.openExternal(url);
    } else {
      const win = window.open(url, '_blank');
      win.focus();
    }
  }
}
