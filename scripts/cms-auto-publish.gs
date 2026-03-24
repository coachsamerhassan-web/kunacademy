/**
 * KUN Academy — CMS Auto-Publish Script
 * Install in the CMS Google Sheet (Extensions > Apps Script).
 *
 * What it does:
 * 1. Watches for edits in the Sheet → triggers site rebuild
 * 2. Watches the KUN CMS Content Drive folder → triggers rebuild when docs change
 * 3. Adds a "KUN CMS" menu with manual publish buttons
 *
 * Setup:
 * 1. Paste this in Extensions > Apps Script
 * 2. Run setupTriggers() once to enable automatic watching
 * 3. Set REVALIDATE_URL to your production URL when deployed
 */

// ── Config ──────────────────────────────────────────────────────────────────

const CONFIG = {
  // Next.js revalidation endpoint (update to production URL when deployed)
  REVALIDATE_URL: 'https://kunacademy.com/api/revalidate',
  REVALIDATE_SECRET: 'a72c8c2943a183cfbe91b6273d65d321',

  // Google Drive folder ID for CMS content docs
  CMS_FOLDER_ID: '1wF_EeIZd5RgO8x2oDtCzzxh0KI9k7JBz',

  // Map sheet tab names to revalidation tags
  TAB_TO_TAG: {
    'Page Content': 'pages',
    'Programs': 'programs',
    'Services': 'services',
    'Team': 'team',
    'Settings': 'settings',
    'Pathfinder': 'pathfinder',
  },
};

// ── Menu ────────────────────────────────────────────────────────────────────

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('KUN CMS')
    .addItem('Publish All Changes', 'publishAll')
    .addItem('Publish This Tab Only', 'publishCurrentTab')
    .addSeparator()
    .addItem('Setup Auto-Publish Triggers', 'setupTriggers')
    .addToUi();
}

// ── Auto-trigger on Sheet edit ──────────────────────────────────────────────

function onEdit(e) {
  if (!e) return;
  const sheet = e.source.getActiveSheet();
  const tabName = sheet.getName();
  const tag = CONFIG.TAB_TO_TAG[tabName];

  if (tag) {
    // Debounce: only trigger if the edit is in a data row (not header)
    if (e.range.getRow() > 1) {
      triggerRevalidation([tag]);
    }
  }
}

// ── Manual publish buttons ──────────────────────────────────────────────────

function publishAll() {
  triggerRevalidation(['cms']);
  SpreadsheetApp.getUi().alert('Site rebuild triggered for all content.');
}

function publishCurrentTab() {
  const tabName = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet().getName();
  const tag = CONFIG.TAB_TO_TAG[tabName] || 'cms';
  triggerRevalidation([tag]);
  SpreadsheetApp.getUi().alert('Site rebuild triggered for: ' + tabName);
}

// ── Drive folder watcher ────────────────────────────────────────────────────
// This runs on a time-based trigger (every 5 minutes) and checks if any
// files in the CMS folder were modified since the last check.

function checkDriveChanges() {
  const props = PropertiesService.getScriptProperties();
  const lastCheck = props.getProperty('lastDriveCheck');
  const since = lastCheck ? new Date(lastCheck) : new Date(Date.now() - 300000);

  const folder = DriveApp.getFolderById(CONFIG.CMS_FOLDER_ID);
  const files = folder.getFiles();
  let hasChanges = false;

  while (files.hasNext()) {
    const file = files.next();
    if (file.getLastUpdated() > since) {
      hasChanges = true;
      break;
    }
  }

  // Also check subfolders
  if (!hasChanges) {
    const subfolders = folder.getFolders();
    while (subfolders.hasNext()) {
      const subfolder = subfolders.next();
      const subfiles = subfolder.getFiles();
      while (subfiles.hasNext()) {
        if (subfiles.next().getLastUpdated() > since) {
          hasChanges = true;
          break;
        }
      }
      if (hasChanges) break;
    }
  }

  if (hasChanges) {
    Logger.log('Drive changes detected — triggering revalidation');
    triggerRevalidation(['cms']);
  }

  props.setProperty('lastDriveCheck', new Date().toISOString());
}

// ── Core: Send revalidation webhook ─────────────────────────────────────────

function triggerRevalidation(tags) {
  try {
    const response = UrlFetchApp.fetch(CONFIG.REVALIDATE_URL, {
      method: 'post',
      contentType: 'application/json',
      headers: {
        'x-revalidate-secret': CONFIG.REVALIDATE_SECRET,
      },
      payload: JSON.stringify({ tags: tags }),
      muteHttpExceptions: true,
    });

    const code = response.getResponseCode();
    if (code === 200) {
      Logger.log('Revalidation triggered: ' + tags.join(', '));
    } else {
      Logger.log('Revalidation failed (' + code + '): ' + response.getContentText());
    }
  } catch (e) {
    Logger.log('Revalidation error: ' + e.message);
  }
}

// ── Setup: Install triggers ─────────────────────────────────────────────────

function setupTriggers() {
  // Remove existing triggers to avoid duplicates
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(t => ScriptApp.deleteTrigger(t));

  // 1. onOpen menu
  ScriptApp.newTrigger('onOpen')
    .forSpreadsheet(SpreadsheetApp.getActive())
    .onOpen()
    .create();

  // 2. onEdit — triggers on every cell edit
  ScriptApp.newTrigger('onEdit')
    .forSpreadsheet(SpreadsheetApp.getActive())
    .onEdit()
    .create();

  // 3. Drive folder watcher — every 5 minutes
  ScriptApp.newTrigger('checkDriveChanges')
    .timeDriven()
    .everyMinutes(5)
    .create();

  SpreadsheetApp.getUi().alert(
    'Auto-publish triggers installed!\n\n' +
    '• Sheet edits → instant site rebuild\n' +
    '• Drive doc changes → checked every 5 minutes\n' +
    '• KUN CMS menu → manual publish anytime'
  );
}
