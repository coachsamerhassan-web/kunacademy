const { google } = require('/Users/samer/kunacademy/node_modules/googleapis');
const fs = require('fs');

async function main() {
  const keyFile = '/Users/samer/kunacademy/credentials/google-service-account.json';
  const key = JSON.parse(fs.readFileSync(keyFile, 'utf8'));

  const auth = new google.auth.GoogleAuth({
    credentials: key,
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });

  const drive = google.drive({ version: 'v3', auth });

  // Step 1: List all shared drives
  console.log('=== Listing Shared Drives ===');
  let sharedDrives = [];
  try {
    const res = await drive.drives.list({
      pageSize: 50,
      fields: 'drives(id,name)',
    });
    sharedDrives = res.data.drives || [];
    for (const d of sharedDrives) {
      console.log(`  Drive: "${d.name}" => ID: ${d.id}`);
    }
  } catch (err) {
    console.error('Error listing drives:', err.message);
  }

  if (sharedDrives.length === 0) {
    console.log('No shared drives found. Trying to search across all drives...');
  }

  // Step 2: For each shared drive, try to find "Kun Management Team" or search directly
  for (const drive_ of sharedDrives) {
    console.log(`\n=== Searching in drive: "${drive_.name}" (${drive_.id}) ===`);
    await searchInDrive(drive, drive_.id, drive_.name);
  }

  // Step 3: Also try a global search (in case drive listing fails but files are accessible)
  console.log('\n=== Global search for folder named "Programs" ===');
  try {
    const res = await drive.files.list({
      q: `name = 'Programs' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: 'files(id,name,parents,driveId)',
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
      corpora: 'allDrives',
      pageSize: 50,
    });
    const files = res.data.files || [];
    console.log(`Found ${files.length} folder(s) named "Programs":`);
    for (const f of files) {
      console.log(`  ID: ${f.id}, Name: ${f.name}, DriveId: ${f.driveId}, Parents: ${JSON.stringify(f.parents)}`);
      // Check if parent is "Website content"
      if (f.parents && f.parents.length > 0) {
        await checkParent(drive, f.parents[0], f.id, f.name);
      }
    }
  } catch (err) {
    console.error('Global search error:', err.message);
  }
}

async function searchInDrive(drive, driveId, driveName) {
  try {
    // Search for folders named "Programs" in this drive
    const res = await drive.files.list({
      q: `name = 'Programs' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: 'files(id,name,parents,driveId)',
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
      corpora: 'drive',
      driveId: driveId,
      pageSize: 50,
    });
    const files = res.data.files || [];
    console.log(`  Found ${files.length} folder(s) named "Programs"`);
    for (const f of files) {
      console.log(`    ID: ${f.id}, Parents: ${JSON.stringify(f.parents)}`);
      if (f.parents && f.parents.length > 0) {
        await checkParent(drive, f.parents[0], f.id, f.name);
      }
    }
  } catch (err) {
    console.error(`  Error searching in drive ${driveName}:`, err.message);
  }
}

async function checkParent(drive, parentId, folderId, folderName) {
  try {
    const res = await drive.files.get({
      fileId: parentId,
      fields: 'id,name',
      supportsAllDrives: true,
    });
    const parent = res.data;
    console.log(`    Parent folder: "${parent.name}" (ID: ${parent.id})`);
    if (parent.name === 'Website content') {
      console.log(`\n  *** FOUND IT! ***`);
      console.log(`  Programs folder ID: ${folderId}`);
      console.log(`  Parent "Website content" ID: ${parentId}`);
    }
  } catch (err) {
    console.error(`    Error getting parent ${parentId}:`, err.message);
  }
}

main().catch(console.error);
