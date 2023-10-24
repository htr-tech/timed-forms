// Spreadsheet Settings
const SpreadsheetID = "xXxXxXxxXXxxXXxxXX"; // Spreadsheet ID
const LoggerSheetID = "LoggedData"; // Logger Sheet Name
const FormSheetName = "FormData"; // Form DB Sheet Name

// ==========================================================
// ==========================================================

const Opensheet = SpreadsheetApp.openById(SpreadsheetID);
const LoggedValues = Opensheet.getSheetByName(LoggerSheetID);
const FormValues = Opensheet.getSheetByName(FormSheetName);

function genURL() {
  console.log(getScriptURL() + "?genForm");
}

// Return Site URL // https://stackoverflow.com/a/61020549
function getScriptURL() {
  return ScriptApp.getService().getUrl();
}

// Append info to spreadsheet / LoggedData
function infoLogger(userID, formID, username, event, useragent) {
  const triggerTime = Utilities.formatDate(
    new Date(),
    Session.getScriptTimeZone(),
    "MM/dd/yyyy HH:mm:ss",
  );
  var rowData = [userID, triggerTime, formID, username, event, useragent];
  LoggedValues.appendRow(rowData);
  SpreadsheetApp.flush();
}

// Append forms to spreadsheet / FormData
function formLogger(formID, formAddr, entry, maxtime, attempt, useragent) {
  const triggerTime = Utilities.formatDate(
    new Date(),
    Session.getScriptTimeZone(),
    "MM/dd/yyyy HH:mm:ss",
  );
  var rowData = [formID, formAddr, entry, maxtime, attempt, triggerTime, useragent];
  FormValues.appendRow(rowData);
  SpreadsheetApp.flush();
}

// Return Error Message
function sendError(errormsg) {
  const template = HtmlService.createTemplateFromFile('error');
  template.passedData = errormsg;
  var html = template.evaluate().setTitle('Error - Timed Forms');
  var output = HtmlService.createHtmlOutput(html);
  output.addMetaTag('viewport', 'width=device-width, initial-scale=1');
  return output;
}

// Generate forms "?genForm"
function genForms(userAgent, formIDS) {
  const fromgenTemplate = HtmlService.createTemplateFromFile("form");
  fromgenTemplate.passedData = { userAgent, formIDS };
  var html = fromgenTemplate.evaluate().setTitle('Generate - Timed Forms');
  var output = HtmlService.createHtmlOutput(html);
  output.addMetaTag('viewport', 'width=device-width, initial-scale=1');
  return output;
}

// Generate & Return MD5sum
function generateMD5Sum(input) {
  var md5sum = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, input);
  var md5sumHex = md5sum.map(function(byte) {
    var val = (byte < 0 ? byte + 256 : byte).toString(16);
    return val.length === 1 ? '0' + val : val;
  }).join('');
  return md5sumHex;
}

function getLoggedValues(range) {
  return LoggedValues.getRange(range).getValues().flat();
}

// Return Form Database
function returnFormData(formID) {
  const row = FormValues.getDataRange().getValues().find(row => row[0] === formID);
  if (row) {
    const finalData = [
      row[1],
      row[2],
      row[3].replace(/\./g, ":"),
      row[4]
    ];
    return finalData;
  }
}

// IDK what does it do
function supersecretfunc() {
  const formData = LoggedValues.getDataRange().getValues();
  let htmlOutput = `<table style='border-spacing: 13px; border-collapse: separate;'>`;

  for (let i = 0; i < formData.length; i++) {
    const [dat0, dat1, dat2, dat3, dat4] = formData[i];
    timezone = String(dat1).replace(/ GMT\+\d{4} \(.*\)$/, "");
    htmlOutput += `<tr><td>${dat0}</td><td>${timezone}</td><td>${dat2}</td><td>${dat3}</td><td>${dat4}</td></tr>`;
  }

  htmlOutput += `</table>`;
  const output = HtmlService.createHtmlOutput(htmlOutput);
  output.addMetaTag('viewport', 'width=device-width, initial-scale=1');
  return output;
}

function doGet(e) {
  const userAgent = HtmlService.getUserAgent();
  const userID = generateMD5Sum(userAgent);
  const formNames = Array.from(new Set(FormValues.getRange("A2:A").getValues().flat()));

  // Get Results
  if (e.parameter.bilai469 !== undefined) {
    return supersecretfunc();
  }

  // Generate new forms
  if (e.parameter.genForm !== undefined) {
    return genForms(userAgent, formNames);
  }

  // Check for invalid forms
  if (e.parameter.fi) {
    const formID = e.parameter.fi;
    if (!formNames.includes(formID)) {
      // No such forms
      infoLogger(userID, formID, "[ No Name ]", "Invalid Form", userAgent);
      return sendError(`Invalid Form ID "${formID}"`);
    }
  }

  const serverTemplate = HtmlService.createTemplateFromFile("popup");

  if (e.parameter.fi && !e.parameter.tr) {
    const formID = e.parameter.fi;
    serverTemplate.serverData = { userID, formID };
  }
  else if (e.parameter.fi && e.parameter.tr) {
    const formID = e.parameter.fi;
    
    const listusers = getLoggedValues("A2:A");
    const listforms = getLoggedValues("C2:C");
    const listnames = getLoggedValues("D2:D");
    const listevent = getLoggedValues("E2:E");
    const FilterUsers = [...new Set(listnames.filter((_, i) => listusers[i] === userID && listforms[i] === formID))];
    const FilterEvent = [... listevent.filter((_, i) => listusers[i] === userID && listforms[i] === formID)];

    if (FilterUsers.length === 1) {
      const FormDatabase = returnFormData(formID);
      if (FilterEvent.filter((x) => x == "Started").length >= FormDatabase[3]) {
        // Form Attempt Exceeded
        infoLogger(userID, formID, FilterUsers[0], "Expired");
        return sendError(`UID was already used.<br><br>UID: ${userID}<br><br>Form ID: ${formID}`);
      }

      // Form Started
      infoLogger(userID, formID, FilterUsers[0], "Started", userAgent);
      const formTemplate = HtmlService.createTemplateFromFile("frame");
      formTemplate.serverData = [userID, ...FormDatabase, formID, FilterUsers[0]];

      const formTemp = formTemplate.evaluate().setTitle(`${formID} - Timed Forms`);
      const formOutput = HtmlService.createHtmlOutput(formTemp);
      formOutput.addMetaTag("viewport", "width=device-width, initial-scale=1");
      return formOutput;
    }
    else if (FilterUsers.length > 1) {
      return sendError(`Multiple profile found with the same UID.<br><br>UID: ${userID}`);
    }
    else {
      // No user with that UID
      infoLogger("[ No UID ]", formID, "[ No Name ]", "No Registration", userAgent);
      return sendError(`Unknown UID.<br>Please Register First.<br><br>UID: ${userID}<br><br>Form ID: ${formID}`);
    }
  }
  else {
    serverTemplate.serverData = { userID };
  }

  // Default Template
  const html = serverTemplate.evaluate().setTitle("Timed Forms");
  const defaultOutput = HtmlService.createHtmlOutput(html);
  defaultOutput.addMetaTag("viewport", "width=device-width, initial-scale=1");
  return defaultOutput;
}

// ------