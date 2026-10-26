/**
 * Serialises `data` to JSON and triggers a browser download.
 */
export function downloadJson(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Opens a JSON file picker and returns the parsed contents as a Promise.
 */
export function readJsonFile() {
  return new Promise((resolve, reject) => {
    const input     = document.createElement('input');
    input.type      = 'file';
    input.accept    = '.json';
    input.style.display = 'none';
    document.body.appendChild(input);

    input.onchange = (e) => {
      document.body.removeChild(input);
      const file = e.target.files[0];
      if (!file) { reject(new Error('No file selected')); return; }
      const reader = new FileReader();
      reader.onload = (ev) => {
        try   { resolve(JSON.parse(ev.target.result)); }
        catch (err) { reject(err); }
      };
      reader.readAsText(file);
    };

    input.click();
  });
}
