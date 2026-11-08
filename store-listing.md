# Eye Care Timer: Chrome Web Store copy

## Short description (max 132 characters)
Break timer for eye care and kids' screen time. Pauses media and shows a friendly lock screen at zero. Parent PIN included.

## Single purpose
Remind the user to take screen breaks: a countdown timer that, when it ends, pauses playing media and shows a break (or kid lock) screen.

## Permission justifications
- **alarms**: runs the countdown so the break fires on time even when the browser is minimized.
- **storage**: saves settings, timer state, custom minutes, the parent PIN (as a salted hash) and daily break counts on the device only.
- **notifications**: shows a desktop notification when the timer ends.
- **scripting**: used only after the user opts in to "Full protection", to pause playing video and audio and to draw the break/lock screen over open tabs.
- **optional host permission (all URLs)**: NOT requested at install. It is requested only when the user clicks "Allow access to all sites" on the Full protection page. Without it, the lock screen opens in its own full-screen window and nothing on web pages is touched. The extension never reads, stores or sends page content.

## Data usage tab
- Collects no user data. Nothing is transmitted off the device.
- Certify: not sold, not used for unrelated purposes, not used for creditworthiness or lending.

## Privacy policy (host this on any public page and paste the URL)
Eye Care Timer does not collect, transmit or share any personal data. All settings, timer state, daily break counts and the optional parent PIN (stored only as a salted hash) are kept locally on your device using Chrome's extension storage. The extension makes no network requests and uses no analytics or third-party services. If you choose the optional Full protection setting, it accesses open web pages only to pause media and to display its lock screen over the page, and it never reads, stores or sends page content.
Contact: YOUR-EMAIL-HERE

## Listing tips
- Describe the close-the-browser feature plainly in the description and say it can be turned off.
- Needed images: 128x128 icon (included), at least one screenshot (1280x800 or 640x400), and the promo tiles the dashboard asks for.
