const mainList = document.getElementById('main-list');
const title = document.getElementById('title');
const backBtn = document.getElementById('back-btn');
const settingsPanel = document.getElementById('settings-panel');
const settingsToggleBtn = document.getElementById('settings-toggle-btn');
const themeSelect = document.getElementById('theme-select');
const exitKeyInput = document.getElementById('exit-key-input');
const startupCheckbox = document.getElementById('startup-checkbox');
const saveSettingsBtn = document.getElementById('save-settings-btn');
const resetSettingsBtn = document.getElementById('reset-settings-btn');
const body = document.body;

let currentState = 'groups';
let currentGroupName = '';
let currentItems = [];
let activeCopyGroup = 'Default';
let exitKey = 'Escape';

// === RENDER FUNCTIONS ===
function renderGroups({ groups, activeGroup }) {
  currentState = 'groups';
  currentGroupName = '';
  activeCopyGroup = activeGroup;
  title.textContent = 'Groups';
  backBtn.style.display = 'none';
  mainList.innerHTML = '';
  groups.forEach((group, index) => {
    const li = document.createElement('li');
    li.dataset.groupName = group;
    const number = (index + 1) % 10;
    const isActive = group === activeCopyGroup ? `<span class="active-indicator">ACTIVE</span>` : '';
    li.innerHTML = `
      ${isActive}
      <span class="number">${number}.</span>
      <span class="item-text">${group}</span>
      <div class="actions">
        <button title="Edit name" class="action-btn edit-btn" data-group="${group}">✏️</button>
        ${group !== 'Default' ? `<button title="Delete group" class="action-btn delete-btn" data-group="${group}">❌</button>` : ''}
      </div>
    `;
    mainList.appendChild(li);
  });
  const addGroupLi = document.createElement('li');
  addGroupLi.className = 'add-group-li';
  addGroupLi.innerHTML = `<span class="number">+</span><span class="item-text">Add New Group</span>`;
  mainList.appendChild(addGroupLi);
}

function renderItems(items) {
  currentState = 'items';
  title.textContent = `Items in "${currentGroupName}"`;
  backBtn.style.display = 'block';
  currentItems = items;
  mainList.innerHTML = '';
  items.forEach((item, index) => {
    const li = document.createElement('li');
    const number = (index + 1) % 10;
    let itemDisplayHTML = '';

    switch (item.type) {
        case 'image':
            itemDisplayHTML = `<img src="${item.content}" style="max-width: 120px; max-height: 40px; border-radius: 3px; margin-right: 10px;" alt="Image clipboard item"><span class="item-text"><i>[Image]</i></span>`;
            break;
        case 'html':
        case 'text':
        default:
            const sanitizedItem = item.content.replace(/</g, "&lt;").replace(/>/g, "&gt;");
            itemDisplayHTML = `<span class="item-text">${sanitizedItem}</span>`;
            break;
    }
    
    li.innerHTML = `
      <span class="number">${number}.</span>
      ${itemDisplayHTML}
      <div class="actions">
        <button class="action-btn delete-btn" data-index="${index}">❌</button>
      </div>
    `;
    mainList.appendChild(li);
  });
}

// === MAIN EVENT HANDLER ===
function saveNewGroup(inputElement) { const newGroupName = inputElement.value.trim(); if (newGroupName) { window.api.addGroup(newGroupName); } else { window.api.requestGroupsView(); } }
function saveGroupNameEdit(inputElement, oldName) { const newName = inputElement.value.trim(); if (newName && newName !== oldName) { window.api.editGroupName({ oldName, newName }); } else { window.api.requestGroupsView(); } }

mainList.addEventListener('click', (event) => {
    const target = event.target;
    const li = target.closest('li');
    if (!li) return;
    if (li.classList.contains('add-group-li')) { li.innerHTML = `<span class="number">+</span><input type="text" class="add-group-input" placeholder="New group name...">`; const input = li.querySelector('input'); input.focus(); input.addEventListener('keydown', (e) => { if (e.key === 'Enter') saveNewGroup(input); if (e.key === 'Escape') window.api.requestGroupsView(); }); input.addEventListener('blur', () => saveNewGroup(input), { once: true }); return; }
    if (target.matches('.delete-btn') && currentState === 'groups') { const group = target.dataset.group; const actionsDiv = li.querySelector('.actions'); actionsDiv.innerHTML = `<button class="confirm-btn confirm-delete-btn" data-group="${group}">Confirm</button><button class="confirm-btn cancel-btn">Cancel</button>`; return; }
    if (target.matches('.confirm-delete-btn')) { window.api.deleteGroup(target.dataset.group); return; }
    if (target.matches('.cancel-btn')) { window.api.requestGroupsView(); return; }
    if (target.matches('.edit-btn')) { const oldName = target.dataset.group; if (oldName === 'Default') return; const itemTextSpan = li.querySelector('.item-text'); const input = document.createElement('input'); input.type = 'text'; input.value = oldName; input.className = 'add-group-input'; itemTextSpan.replaceWith(input); input.focus(); input.select(); input.addEventListener('blur', () => saveGroupNameEdit(input, oldName), { once: true }); input.addEventListener('keydown', (e) => { if (e.key === 'Enter') saveGroupNameEdit(input, oldName); if (e.key === 'Escape') window.api.requestGroupsView(); }); return; }
    
    if (target.matches('.delete-btn') && currentState === 'items') { 
        const index = parseInt(target.dataset.index, 10); 
        const itemToDelete = currentItems[index]; 
        if(itemToDelete) { 
            window.api.deleteItem({ groupName: currentGroupName, itemToDelete }); 
        } 
        return; 
    }
    
    if (li.dataset.groupName && currentState === 'groups') { currentGroupName = li.dataset.groupName; window.api.getGroupItems(currentGroupName); } 
    else if (currentState === 'items') { 
        const itemIndex = Array.from(li.parentNode.children).indexOf(li); 
        const itemToPaste = currentItems[itemIndex]; 
        if (itemToPaste) window.api.pasteItem(itemToPaste); 
    }
});

// === IPC & OTHER LISTENERS ===
window.api.onShowGroups((data) => renderGroups(data));
window.api.onShowItems((items) => renderItems(items));
backBtn.addEventListener('click', () => { window.api.requestGroupsView(); });

document.addEventListener('keydown', (event) => {
    if (document.activeElement.tagName === 'INPUT') return;
    if (event.key === 'Escape' && currentState === 'items') { backBtn.click(); return; }
    
    if (event.key.toLowerCase() === exitKey.toLowerCase()) { 
        window.api.hideWindow();
        return; 
    }

    if (event.ctrlKey || event.shiftKey) return;
    const key = parseInt(event.key, 10);
    if (isNaN(key)) return;
    const index = key === 0 ? 9 : key - 1;
    if (currentState === 'groups') { const groupLi = mainList.children[index]; if (groupLi?.dataset.groupName) { currentGroupName = groupLi.dataset.groupName; window.api.getGroupItems(currentGroupName); } } 
    else if (currentState === 'items') { 
        const itemToModify = currentItems[index]; 
        if (itemToModify) { 
            if (event.altKey) window.api.deleteItem({ groupName: currentGroupName, itemToDelete: itemToModify }); 
            else window.api.pasteItem(itemToModify); 
        } 
    }
});

// === SETTINGS PANEL LOGIC ===
exitKeyInput.addEventListener('click', () => { exitKeyInput.value = 'Press any key...'; exitKeyInput.addEventListener('keydown', (event) => { event.preventDefault(); const newKey = event.key === ' ' ? 'Space' : event.key; exitKeyInput.value = newKey; }, { once: true }); });
function loadSettings() { const settings = window.api.getSettings(); if (settings) { themeSelect.value = settings.theme || 'dark'; exitKeyInput.value = settings.exitKey || 'Escape'; exitKey = settings.exitKey || 'Escape'; startupCheckbox.checked = settings.launchOnStartup === true; body.className = `${settings.theme}-theme`; } }
settingsToggleBtn.addEventListener('click', () => { const isHidden = settingsPanel.style.display === 'none'; settingsPanel.style.display = isHidden ? 'block' : 'none'; if(isHidden) loadSettings(); });
saveSettingsBtn.addEventListener('click', () => { if (exitKeyInput.value === 'Press any key...') { exitKeyInput.value = exitKey; } const newSettings = { theme: themeSelect.value, exitKey: exitKeyInput.value, launchOnStartup: startupCheckbox.checked }; window.api.saveSettings(newSettings); exitKey = newSettings.exitKey; settingsPanel.style.display = 'none'; body.className = `${newSettings.theme}-theme`; });
resetSettingsBtn.addEventListener('click', () => { if (confirm('Are you sure you want to reset your settings? Your clipboard history will not be deleted.')) { window.api.resetSettings(); loadSettings(); alert('Settings have been reset.'); settingsPanel.style.display = 'none'; } });

loadSettings();