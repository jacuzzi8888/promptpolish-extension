# PromptPolish Extension 🪄

A powerful browser extension that enhances your prompts in real-time using AI. Transform vague, unclear prompts into polished, professional ones with a single click.

## ✨ Features

### Core Functionality
- **One-Click Optimization** - Click the magic wand button or press `Ctrl+Shift+P` to optimize any text field
- **Multiple Modes** - Choose from Concise, Creative, Formal, Analyze, or Custom modes
- **Smart Clarification** - Automatically asks clarifying questions for very short prompts
- **Undo Support** - Easily revert to your original text if needed

### User Experience
- **Keyboard Shortcuts** - `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac) to optimize from anywhere
- **Visual Feedback** - Toast notifications for success, errors, and status updates
- **Loading States** - Animated spinner shows when requests are processing
- **Auto-Save Settings** - Your preferences are saved automatically as you change them
- **Rate Limiting** - Prevents accidental API spam with built-in delays

### Technical Features
- **Input Validation** - Sanitizes and validates all inputs before processing
- **Request Timeouts** - Automatic timeout after 30 seconds prevents hanging
- **Error Handling** - Comprehensive error messages for all failure scenarios
- **Memory Safe** - Proper cleanup of event listeners prevents memory leaks
- **Accessibility** - Full ARIA labels and keyboard navigation support

## 🚀 Installation

### From Source
1. Clone or download this repository
2. Open Chrome/Edge and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked"
5. Select the extension directory

### Configuration
1. Click the extension icon in your browser toolbar
2. Enable "Enable Optimization"
3. Choose your preferred optimization mode
4. (Optional) Add a custom instruction for custom mode

## 🎯 Usage

### Using the Button
1. Click or focus on any text field on any webpage
2. A magic wand button (🪄) will appear in the top-right corner of the field
3. Click the button to optimize your text
4. If you want to revert, click the orange undo button that appears

### Using Keyboard Shortcuts
1. Focus on any text field
2. Press `Ctrl+Shift+P` (Windows/Linux) or `Cmd+Shift+P` (Mac)
3. Your text will be optimized automatically
4. Press the undo button or manually edit to revert

### Optimization Modes

| Mode | Description |
|------|-------------|
| **Concise** | Makes prompts shorter and more direct |
| **Creative** | Adds flair and creativity to prompts |
| **Formal** | Converts to professional, formal language |
| **Analyze** | Provides analysis and suggestions |
| **Custom** | Uses your custom instruction for optimization |

## ⚙️ Settings

Access settings by clicking the extension icon:

- **Enable Optimization** - Global on/off switch for the extension
- **Auto clarify very short prompts** - Asks clarifying questions for vague inputs
- **Mode** - Select your preferred optimization style
- **Custom Instruction** - Define your own optimization rules (max 1000 characters)

All settings are saved automatically as you change them.

## 🎨 Features in Detail

### Undo Functionality
Every optimization stores your original text. Click the orange undo button (↶) that appears after optimization to revert instantly.

### Toast Notifications
Get immediate feedback:
- ✓ Green toast: Success
- ⚠️ Red toast: Errors or warnings
- ℹ️ Gray toast: Information

### Rate Limiting
To prevent API abuse, there's a 1-second cooldown between optimization requests. You'll see a toast notification if you try too quickly.

### Input Validation
- Maximum text length: 10,000 characters
- Maximum custom instruction: 1,000 characters
- Inputs are sanitized to prevent injection attacks

## 🔧 Troubleshooting

### Button Doesn't Appear
- Make sure "Enable Optimization" is turned on in settings
- Refresh the page after installing or enabling the extension
- The button only appears in editable text fields (not on internal browser pages)

### Optimization Fails
- Check your internet connection
- Ensure the Cloudflare Worker URL is configured in `background.js`
- Check the browser console for detailed error messages

### Keyboard Shortcut Not Working
- Make sure the text field is focused (click inside it first)
- On some sites, keyboard shortcuts may be intercepted
- Try using the button instead

### Settings Not Saving
- Check that you have "storage" permission enabled
- Try disabling and re-enabling the extension
- Check browser console for storage errors

## 🏗️ Architecture

The extension consists of three main components:

### Content Script (`content.js`)
- Monitors all text fields on web pages
- Injects the optimization button
- Handles keyboard shortcuts
- Manages undo functionality
- Shows toast notifications

### Background Script (`background.js`)
- Processes optimization requests
- Communicates with Cloudflare Worker API
- Handles error cases and timeouts
- Validates and sanitizes inputs

### Popup UI (`popup.html`, `popup.css`, `popup.js`)
- Settings interface
- Auto-saves user preferences
- Modern, animated design
- Fully accessible

## 🎨 Design Philosophy

PromptPolish follows modern web design principles:
- **Micro-animations** - Smooth transitions on every interaction
- **Premium aesthetics** - Gradient backgrounds, shadows, and glows
- **Dark theme** - Easy on the eyes with teal/green accent colors
- **Accessibility first** - Full ARIA support and keyboard navigation
- **Responsive feedback** - Immediate visual response to all actions

## 🔐 Privacy & Security

- **Input Sanitization** - All inputs are sanitized before processing
- **No Data Storage** - Only settings are stored locally
- **Secure Communication** - All API calls use HTTPS
- **No Tracking** - Extension doesn't track or collect user data

## 📝 Version History

### v1.3.1 (Enhanced)
- ✨ Added keyboard shortcuts (Ctrl+Shift+P)
- 🔄 Added undo functionality
- 🎨 Enhanced UI with modern animations
- 🔔 Added toast notifications
- ⏱️ Added rate limiting
- 🛡️ Improved input validation and sanitization
- ⏰ Added request timeout handling
- ♿ Improved accessibility with ARIA labels
- 🧹 Fixed memory leaks with proper cleanup
- 💾 Added auto-save for settings

## 🤝 Contributing

Contributions are welcome! Please feel free to submit pull requests or open issues for bugs and feature requests.

## 📄 License

This project is provided as-is for personal and educational use.

## 🔗 Resources

- [Chrome Extension Documentation](https://developer.chrome.com/docs/extensions/)
- [Manifest V3 Migration Guide](https://developer.chrome.com/docs/extensions/mv3/intro/)

---

Made with ❤️ by the PromptPolish team
