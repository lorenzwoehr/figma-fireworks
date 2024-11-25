
# Figma + FigJam plugin: Fireworks 🎆

Add joy to your cleanup sessions with playful particle explosions that trigger whenever you delete layers. Watch as your deleted elements burst into colorful particles, making cleanup not just productive, but actually fun!

[![button](https://raw.githubusercontent.com/lorenzwoehr/figma-fireworks/main/media/button.svg)](https://www.figma.com/community/plugin/1441877327046958424/fireworks)

![cover-art](https://raw.githubusercontent.com/lorenzwoehr/figma-fireworks/refs/heads/main/media/cover-art.png)

## Getting Started
Before installing, you'll need to compile the code using the TypeScript compiler. To install TypeScript, first [install Node.js](https://nodejs.org/en/download/). Then:
```
$ npm install -g typescript
```

Next install the packages that the plugin depends on:
```
$ git clone https://github.com/lorenzwoehr/figma-fireworks
$ cd figma-fireworks
$ npm install
```

Compile the plugin:
```
$ npm run build
```

Now you can import the plugin from within the Figma desktop app (`Plugins > Development > Import plugin from manifest...` from the right-click menu)!


## How to use
Just run the plugin, delete any layer(s) and watch the magic happen! ✨
