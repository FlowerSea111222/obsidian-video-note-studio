const obsidian = require("obsidian");
const { createDiv } = obsidian;
const {
  Plugin, ItemView, WorkspaceLeaf, Notice, PluginSettingTab, Setting, Modal,
  FuzzySuggestModal, TFile, TFolder, TAbstractFile, normalizePath, requestUrl,
} = obsidian;

let cp = null;
try { cp = require("child_process"); } catch (e) { cp = null; }
const qrGenerator = (() => {
  const module = { exports: {} };
  const exports = module.exports;

//---------------------------------------------------------------------
//
// QR Code Generator for JavaScript
//
// Copyright (c) 2009 Kazuhiko Arase
//
// URL: http://www.d-project.com/
//
// Licensed under the MIT license:
//  http://www.opensource.org/licenses/mit-license.php
//
// The word 'QR Code' is registered trademark of
// DENSO WAVE INCORPORATED
//  http://www.denso-wave.com/qrcode/faqpatent-e.html
//
//---------------------------------------------------------------------

var qrcode = function() {

  //---------------------------------------------------------------------
  // qrcode
  //---------------------------------------------------------------------

  /**
   * qrcode
   * @param typeNumber 1 to 40
   * @param errorCorrectionLevel 'L','M','Q','H'
   */
  var qrcode = function(typeNumber, errorCorrectionLevel) {

    var PAD0 = 0xEC;
    var PAD1 = 0x11;

    var _typeNumber = typeNumber;
    var _errorCorrectionLevel = QRErrorCorrectionLevel[errorCorrectionLevel];
    var _modules = null;
    var _moduleCount = 0;
    var _dataCache = null;
    var _dataList = [];

    var _this = {};

    var makeImpl = function(test, maskPattern) {

      _moduleCount = _typeNumber * 4 + 17;
      _modules = function(moduleCount) {
        var modules = new Array(moduleCount);
        for (var row = 0; row < moduleCount; row += 1) {
          modules[row] = new Array(moduleCount);
          for (var col = 0; col < moduleCount; col += 1) {
            modules[row][col] = null;
          }
        }
        return modules;
      }(_moduleCount);

      setupPositionProbePattern(0, 0);
      setupPositionProbePattern(_moduleCount - 7, 0);
      setupPositionProbePattern(0, _moduleCount - 7);
      setupPositionAdjustPattern();
      setupTimingPattern();
      setupTypeInfo(test, maskPattern);

      if (_typeNumber >= 7) {
        setupTypeNumber(test);
      }

      if (_dataCache == null) {
        _dataCache = createData(_typeNumber, _errorCorrectionLevel, _dataList);
      }

      mapData(_dataCache, maskPattern);
    };

    var setupPositionProbePattern = function(row, col) {

      for (var r = -1; r <= 7; r += 1) {

        if (row + r <= -1 || _moduleCount <= row + r) continue;

        for (var c = -1; c <= 7; c += 1) {

          if (col + c <= -1 || _moduleCount <= col + c) continue;

          if ( (0 <= r && r <= 6 && (c == 0 || c == 6) )
              || (0 <= c && c <= 6 && (r == 0 || r == 6) )
              || (2 <= r && r <= 4 && 2 <= c && c <= 4) ) {
            _modules[row + r][col + c] = true;
          } else {
            _modules[row + r][col + c] = false;
          }
        }
      }
    };

    var getBestMaskPattern = function() {

      var minLostPoint = 0;
      var pattern = 0;

      for (var i = 0; i < 8; i += 1) {

        makeImpl(true, i);

        var lostPoint = QRUtil.getLostPoint(_this);

        if (i == 0 || minLostPoint > lostPoint) {
          minLostPoint = lostPoint;
          pattern = i;
        }
      }

      return pattern;
    };

    var setupTimingPattern = function() {

      for (var r = 8; r < _moduleCount - 8; r += 1) {
        if (_modules[r][6] != null) {
          continue;
        }
        _modules[r][6] = (r % 2 == 0);
      }

      for (var c = 8; c < _moduleCount - 8; c += 1) {
        if (_modules[6][c] != null) {
          continue;
        }
        _modules[6][c] = (c % 2 == 0);
      }
    };

    var setupPositionAdjustPattern = function() {

      var pos = QRUtil.getPatternPosition(_typeNumber);

      for (var i = 0; i < pos.length; i += 1) {

        for (var j = 0; j < pos.length; j += 1) {

          var row = pos[i];
          var col = pos[j];

          if (_modules[row][col] != null) {
            continue;
          }

          for (var r = -2; r <= 2; r += 1) {

            for (var c = -2; c <= 2; c += 1) {

              if (r == -2 || r == 2 || c == -2 || c == 2
                  || (r == 0 && c == 0) ) {
                _modules[row + r][col + c] = true;
              } else {
                _modules[row + r][col + c] = false;
              }
            }
          }
        }
      }
    };

    var setupTypeNumber = function(test) {

      var bits = QRUtil.getBCHTypeNumber(_typeNumber);

      for (var i = 0; i < 18; i += 1) {
        var mod = (!test && ( (bits >> i) & 1) == 1);
        _modules[Math.floor(i / 3)][i % 3 + _moduleCount - 8 - 3] = mod;
      }

      for (var i = 0; i < 18; i += 1) {
        var mod = (!test && ( (bits >> i) & 1) == 1);
        _modules[i % 3 + _moduleCount - 8 - 3][Math.floor(i / 3)] = mod;
      }
    };

    var setupTypeInfo = function(test, maskPattern) {

      var data = (_errorCorrectionLevel << 3) | maskPattern;
      var bits = QRUtil.getBCHTypeInfo(data);

      // vertical
      for (var i = 0; i < 15; i += 1) {

        var mod = (!test && ( (bits >> i) & 1) == 1);

        if (i < 6) {
          _modules[i][8] = mod;
        } else if (i < 8) {
          _modules[i + 1][8] = mod;
        } else {
          _modules[_moduleCount - 15 + i][8] = mod;
        }
      }

      // horizontal
      for (var i = 0; i < 15; i += 1) {

        var mod = (!test && ( (bits >> i) & 1) == 1);

        if (i < 8) {
          _modules[8][_moduleCount - i - 1] = mod;
        } else if (i < 9) {
          _modules[8][15 - i - 1 + 1] = mod;
        } else {
          _modules[8][15 - i - 1] = mod;
        }
      }

      // fixed module
      _modules[_moduleCount - 8][8] = (!test);
    };

    var mapData = function(data, maskPattern) {

      var inc = -1;
      var row = _moduleCount - 1;
      var bitIndex = 7;
      var byteIndex = 0;
      var maskFunc = QRUtil.getMaskFunction(maskPattern);

      for (var col = _moduleCount - 1; col > 0; col -= 2) {

        if (col == 6) col -= 1;

        while (true) {

          for (var c = 0; c < 2; c += 1) {

            if (_modules[row][col - c] == null) {

              var dark = false;

              if (byteIndex < data.length) {
                dark = ( ( (data[byteIndex] >>> bitIndex) & 1) == 1);
              }

              var mask = maskFunc(row, col - c);

              if (mask) {
                dark = !dark;
              }

              _modules[row][col - c] = dark;
              bitIndex -= 1;

              if (bitIndex == -1) {
                byteIndex += 1;
                bitIndex = 7;
              }
            }
          }

          row += inc;

          if (row < 0 || _moduleCount <= row) {
            row -= inc;
            inc = -inc;
            break;
          }
        }
      }
    };

    var createBytes = function(buffer, rsBlocks) {

      var offset = 0;

      var maxDcCount = 0;
      var maxEcCount = 0;

      var dcdata = new Array(rsBlocks.length);
      var ecdata = new Array(rsBlocks.length);

      for (var r = 0; r < rsBlocks.length; r += 1) {

        var dcCount = rsBlocks[r].dataCount;
        var ecCount = rsBlocks[r].totalCount - dcCount;

        maxDcCount = Math.max(maxDcCount, dcCount);
        maxEcCount = Math.max(maxEcCount, ecCount);

        dcdata[r] = new Array(dcCount);

        for (var i = 0; i < dcdata[r].length; i += 1) {
          dcdata[r][i] = 0xff & buffer.getBuffer()[i + offset];
        }
        offset += dcCount;

        var rsPoly = QRUtil.getErrorCorrectPolynomial(ecCount);
        var rawPoly = qrPolynomial(dcdata[r], rsPoly.getLength() - 1);

        var modPoly = rawPoly.mod(rsPoly);
        ecdata[r] = new Array(rsPoly.getLength() - 1);
        for (var i = 0; i < ecdata[r].length; i += 1) {
          var modIndex = i + modPoly.getLength() - ecdata[r].length;
          ecdata[r][i] = (modIndex >= 0)? modPoly.getAt(modIndex) : 0;
        }
      }

      var totalCodeCount = 0;
      for (var i = 0; i < rsBlocks.length; i += 1) {
        totalCodeCount += rsBlocks[i].totalCount;
      }

      var data = new Array(totalCodeCount);
      var index = 0;

      for (var i = 0; i < maxDcCount; i += 1) {
        for (var r = 0; r < rsBlocks.length; r += 1) {
          if (i < dcdata[r].length) {
            data[index] = dcdata[r][i];
            index += 1;
          }
        }
      }

      for (var i = 0; i < maxEcCount; i += 1) {
        for (var r = 0; r < rsBlocks.length; r += 1) {
          if (i < ecdata[r].length) {
            data[index] = ecdata[r][i];
            index += 1;
          }
        }
      }

      return data;
    };

    var createData = function(typeNumber, errorCorrectionLevel, dataList) {

      var rsBlocks = QRRSBlock.getRSBlocks(typeNumber, errorCorrectionLevel);

      var buffer = qrBitBuffer();

      for (var i = 0; i < dataList.length; i += 1) {
        var data = dataList[i];
        buffer.put(data.getMode(), 4);
        buffer.put(data.getLength(), QRUtil.getLengthInBits(data.getMode(), typeNumber) );
        data.write(buffer);
      }

      // calc num max data.
      var totalDataCount = 0;
      for (var i = 0; i < rsBlocks.length; i += 1) {
        totalDataCount += rsBlocks[i].dataCount;
      }

      if (buffer.getLengthInBits() > totalDataCount * 8) {
        throw 'code length overflow. ('
          + buffer.getLengthInBits()
          + '>'
          + totalDataCount * 8
          + ')';
      }

      // end code
      if (buffer.getLengthInBits() + 4 <= totalDataCount * 8) {
        buffer.put(0, 4);
      }

      // padding
      while (buffer.getLengthInBits() % 8 != 0) {
        buffer.putBit(false);
      }

      // padding
      while (true) {

        if (buffer.getLengthInBits() >= totalDataCount * 8) {
          break;
        }
        buffer.put(PAD0, 8);

        if (buffer.getLengthInBits() >= totalDataCount * 8) {
          break;
        }
        buffer.put(PAD1, 8);
      }

      return createBytes(buffer, rsBlocks);
    };

    _this.addData = function(data, mode) {

      mode = mode || 'Byte';

      var newData = null;

      switch(mode) {
      case 'Numeric' :
        newData = qrNumber(data);
        break;
      case 'Alphanumeric' :
        newData = qrAlphaNum(data);
        break;
      case 'Byte' :
        newData = qr8BitByte(data);
        break;
      case 'Kanji' :
        newData = qrKanji(data);
        break;
      default :
        throw 'mode:' + mode;
      }

      _dataList.push(newData);
      _dataCache = null;
    };

    _this.isDark = function(row, col) {
      if (row < 0 || _moduleCount <= row || col < 0 || _moduleCount <= col) {
        throw row + ',' + col;
      }
      return _modules[row][col];
    };

    _this.getModuleCount = function() {
      return _moduleCount;
    };

    _this.make = function() {
      if (_typeNumber < 1) {
        var typeNumber = 1;

        for (; typeNumber < 40; typeNumber++) {
          var rsBlocks = QRRSBlock.getRSBlocks(typeNumber, _errorCorrectionLevel);
          var buffer = qrBitBuffer();

          for (var i = 0; i < _dataList.length; i++) {
            var data = _dataList[i];
            buffer.put(data.getMode(), 4);
            buffer.put(data.getLength(), QRUtil.getLengthInBits(data.getMode(), typeNumber) );
            data.write(buffer);
          }

          var totalDataCount = 0;
          for (var i = 0; i < rsBlocks.length; i++) {
            totalDataCount += rsBlocks[i].dataCount;
          }

          if (buffer.getLengthInBits() <= totalDataCount * 8) {
            break;
          }
        }

        _typeNumber = typeNumber;
      }

      makeImpl(false, getBestMaskPattern() );
    };

    _this.createTableTag = function(cellSize, margin) {

      cellSize = cellSize || 2;
      margin = (typeof margin == 'undefined')? cellSize * 4 : margin;

      var qrHtml = '';

      qrHtml += '<table style="';
      qrHtml += ' border-width: 0px; border-style: none;';
      qrHtml += ' border-collapse: collapse;';
      qrHtml += ' padding: 0px; margin: ' + margin + 'px;';
      qrHtml += '">';
      qrHtml += '<tbody>';

      for (var r = 0; r < _this.getModuleCount(); r += 1) {

        qrHtml += '<tr>';

        for (var c = 0; c < _this.getModuleCount(); c += 1) {
          qrHtml += '<td style="';
          qrHtml += ' border-width: 0px; border-style: none;';
          qrHtml += ' border-collapse: collapse;';
          qrHtml += ' padding: 0px; margin: 0px;';
          qrHtml += ' width: ' + cellSize + 'px;';
          qrHtml += ' height: ' + cellSize + 'px;';
          qrHtml += ' background-color: ';
          qrHtml += _this.isDark(r, c)? '#000000' : '#ffffff';
          qrHtml += ';';
          qrHtml += '"/>';
        }

        qrHtml += '</tr>';
      }

      qrHtml += '</tbody>';
      qrHtml += '</table>';

      return qrHtml;
    };

    _this.createSvgTag = function(cellSize, margin, alt, title) {

      var opts = {};
      if (typeof arguments[0] == 'object') {
        // Called by options.
        opts = arguments[0];
        // overwrite cellSize and margin.
        cellSize = opts.cellSize;
        margin = opts.margin;
        alt = opts.alt;
        title = opts.title;
      }

      cellSize = cellSize || 2;
      margin = (typeof margin == 'undefined')? cellSize * 4 : margin;

      // Compose alt property surrogate
      alt = (typeof alt === 'string') ? {text: alt} : alt || {};
      alt.text = alt.text || null;
      alt.id = (alt.text) ? alt.id || 'qrcode-description' : null;

      // Compose title property surrogate
      title = (typeof title === 'string') ? {text: title} : title || {};
      title.text = title.text || null;
      title.id = (title.text) ? title.id || 'qrcode-title' : null;

      var size = _this.getModuleCount() * cellSize + margin * 2;
      var c, mc, r, mr, qrSvg='', rect;

      rect = 'l' + cellSize + ',0 0,' + cellSize +
        ' -' + cellSize + ',0 0,-' + cellSize + 'z ';

      qrSvg += '<svg version="1.1" xmlns="http://www.w3.org/2000/svg"';
      qrSvg += !opts.scalable ? ' width="' + size + 'px" height="' + size + 'px"' : '';
      qrSvg += ' viewBox="0 0 ' + size + ' ' + size + '" ';
      qrSvg += ' preserveAspectRatio="xMinYMin meet"';
      qrSvg += (title.text || alt.text) ? ' role="img" aria-labelledby="' +
          escapeXml([title.id, alt.id].join(' ').trim() ) + '"' : '';
      qrSvg += '>';
      qrSvg += (title.text) ? '<title id="' + escapeXml(title.id) + '">' +
          escapeXml(title.text) + '</title>' : '';
      qrSvg += (alt.text) ? '<description id="' + escapeXml(alt.id) + '">' +
          escapeXml(alt.text) + '</description>' : '';
      qrSvg += '<rect width="100%" height="100%" fill="white" cx="0" cy="0"/>';
      qrSvg += '<path d="';

      for (r = 0; r < _this.getModuleCount(); r += 1) {
        mr = r * cellSize + margin;
        for (c = 0; c < _this.getModuleCount(); c += 1) {
          if (_this.isDark(r, c) ) {
            mc = c*cellSize+margin;
            qrSvg += 'M' + mc + ',' + mr + rect;
          }
        }
      }

      qrSvg += '" stroke="transparent" fill="black"/>';
      qrSvg += '</svg>';

      return qrSvg;
    };

    _this.createDataURL = function(cellSize, margin) {

      cellSize = cellSize || 2;
      margin = (typeof margin == 'undefined')? cellSize * 4 : margin;

      var size = _this.getModuleCount() * cellSize + margin * 2;
      var min = margin;
      var max = size - margin;

      return createDataURL(size, size, function(x, y) {
        if (min <= x && x < max && min <= y && y < max) {
          var c = Math.floor( (x - min) / cellSize);
          var r = Math.floor( (y - min) / cellSize);
          return _this.isDark(r, c)? 0 : 1;
        } else {
          return 1;
        }
      } );
    };

    _this.createImgTag = function(cellSize, margin, alt) {

      cellSize = cellSize || 2;
      margin = (typeof margin == 'undefined')? cellSize * 4 : margin;

      var size = _this.getModuleCount() * cellSize + margin * 2;

      var img = '';
      img += '<img';
      img += '\u0020src="';
      img += _this.createDataURL(cellSize, margin);
      img += '"';
      img += '\u0020width="';
      img += size;
      img += '"';
      img += '\u0020height="';
      img += size;
      img += '"';
      if (alt) {
        img += '\u0020alt="';
        img += escapeXml(alt);
        img += '"';
      }
      img += '/>';

      return img;
    };

    var escapeXml = function(s) {
      var escaped = '';
      for (var i = 0; i < s.length; i += 1) {
        var c = s.charAt(i);
        switch(c) {
        case '<': escaped += '&lt;'; break;
        case '>': escaped += '&gt;'; break;
        case '&': escaped += '&amp;'; break;
        case '"': escaped += '&quot;'; break;
        default : escaped += c; break;
        }
      }
      return escaped;
    };

    var _createHalfASCII = function(margin) {
      var cellSize = 1;
      margin = (typeof margin == 'undefined')? cellSize * 2 : margin;

      var size = _this.getModuleCount() * cellSize + margin * 2;
      var min = margin;
      var max = size - margin;

      var y, x, r1, r2, p;

      var blocks = {
        '██': '█',
        '█ ': '▀',
        ' █': '▄',
        '  ': ' '
      };

      var blocksLastLineNoMargin = {
        '██': '▀',
        '█ ': '▀',
        ' █': ' ',
        '  ': ' '
      };

      var ascii = '';
      for (y = 0; y < size; y += 2) {
        r1 = Math.floor((y - min) / cellSize);
        r2 = Math.floor((y + 1 - min) / cellSize);
        for (x = 0; x < size; x += 1) {
          p = '█';

          if (min <= x && x < max && min <= y && y < max && _this.isDark(r1, Math.floor((x - min) / cellSize))) {
            p = ' ';
          }

          if (min <= x && x < max && min <= y+1 && y+1 < max && _this.isDark(r2, Math.floor((x - min) / cellSize))) {
            p += ' ';
          }
          else {
            p += '█';
          }

          // Output 2 characters per pixel, to create full square. 1 character per pixels gives only half width of square.
          ascii += (margin < 1 && y+1 >= max) ? blocksLastLineNoMargin[p] : blocks[p];
        }

        ascii += '\n';
      }

      if (size % 2 && margin > 0) {
        return ascii.substring(0, ascii.length - size - 1) + Array(size+1).join('▀');
      }

      return ascii.substring(0, ascii.length-1);
    };

    _this.createASCII = function(cellSize, margin) {
      cellSize = cellSize || 1;

      if (cellSize < 2) {
        return _createHalfASCII(margin);
      }

      cellSize -= 1;
      margin = (typeof margin == 'undefined')? cellSize * 2 : margin;

      var size = _this.getModuleCount() * cellSize + margin * 2;
      var min = margin;
      var max = size - margin;

      var y, x, r, p;

      var white = Array(cellSize+1).join('██');
      var black = Array(cellSize+1).join('  ');

      var ascii = '';
      var line = '';
      for (y = 0; y < size; y += 1) {
        r = Math.floor( (y - min) / cellSize);
        line = '';
        for (x = 0; x < size; x += 1) {
          p = 1;

          if (min <= x && x < max && min <= y && y < max && _this.isDark(r, Math.floor((x - min) / cellSize))) {
            p = 0;
          }

          // Output 2 characters per pixel, to create full square. 1 character per pixels gives only half width of square.
          line += p ? white : black;
        }

        for (r = 0; r < cellSize; r += 1) {
          ascii += line + '\n';
        }
      }

      return ascii.substring(0, ascii.length-1);
    };

    _this.renderTo2dContext = function(context, cellSize) {
      cellSize = cellSize || 2;
      var length = _this.getModuleCount();
      for (var row = 0; row < length; row++) {
        for (var col = 0; col < length; col++) {
          context.fillStyle = _this.isDark(row, col) ? 'black' : 'white';
          context.fillRect(row * cellSize, col * cellSize, cellSize, cellSize);
        }
      }
    }

    return _this;
  };

  //---------------------------------------------------------------------
  // qrcode.stringToBytes
  //---------------------------------------------------------------------

  qrcode.stringToBytesFuncs = {
    'default' : function(s) {
      var bytes = [];
      for (var i = 0; i < s.length; i += 1) {
        var c = s.charCodeAt(i);
        bytes.push(c & 0xff);
      }
      return bytes;
    }
  };

  qrcode.stringToBytes = qrcode.stringToBytesFuncs['default'];

  //---------------------------------------------------------------------
  // qrcode.createStringToBytes
  //---------------------------------------------------------------------

  /**
   * @param unicodeData base64 string of byte array.
   * [16bit Unicode],[16bit Bytes], ...
   * @param numChars
   */
  qrcode.createStringToBytes = function(unicodeData, numChars) {

    // create conversion map.

    var unicodeMap = function() {

      var bin = base64DecodeInputStream(unicodeData);
      var read = function() {
        var b = bin.read();
        if (b == -1) throw 'eof';
        return b;
      };

      var count = 0;
      var unicodeMap = {};
      while (true) {
        var b0 = bin.read();
        if (b0 == -1) break;
        var b1 = read();
        var b2 = read();
        var b3 = read();
        var k = String.fromCharCode( (b0 << 8) | b1);
        var v = (b2 << 8) | b3;
        unicodeMap[k] = v;
        count += 1;
      }
      if (count != numChars) {
        throw count + ' != ' + numChars;
      }

      return unicodeMap;
    }();

    var unknownChar = '?'.charCodeAt(0);

    return function(s) {
      var bytes = [];
      for (var i = 0; i < s.length; i += 1) {
        var c = s.charCodeAt(i);
        if (c < 128) {
          bytes.push(c);
        } else {
          var b = unicodeMap[s.charAt(i)];
          if (typeof b == 'number') {
            if ( (b & 0xff) == b) {
              // 1byte
              bytes.push(b);
            } else {
              // 2bytes
              bytes.push(b >>> 8);
              bytes.push(b & 0xff);
            }
          } else {
            bytes.push(unknownChar);
          }
        }
      }
      return bytes;
    };
  };

  //---------------------------------------------------------------------
  // QRMode
  //---------------------------------------------------------------------

  var QRMode = {
    MODE_NUMBER :    1 << 0,
    MODE_ALPHA_NUM : 1 << 1,
    MODE_8BIT_BYTE : 1 << 2,
    MODE_KANJI :     1 << 3
  };

  //---------------------------------------------------------------------
  // QRErrorCorrectionLevel
  //---------------------------------------------------------------------

  var QRErrorCorrectionLevel = {
    L : 1,
    M : 0,
    Q : 3,
    H : 2
  };

  //---------------------------------------------------------------------
  // QRMaskPattern
  //---------------------------------------------------------------------

  var QRMaskPattern = {
    PATTERN000 : 0,
    PATTERN001 : 1,
    PATTERN010 : 2,
    PATTERN011 : 3,
    PATTERN100 : 4,
    PATTERN101 : 5,
    PATTERN110 : 6,
    PATTERN111 : 7
  };

  //---------------------------------------------------------------------
  // QRUtil
  //---------------------------------------------------------------------

  var QRUtil = function() {

    var PATTERN_POSITION_TABLE = [
      [],
      [6, 18],
      [6, 22],
      [6, 26],
      [6, 30],
      [6, 34],
      [6, 22, 38],
      [6, 24, 42],
      [6, 26, 46],
      [6, 28, 50],
      [6, 30, 54],
      [6, 32, 58],
      [6, 34, 62],
      [6, 26, 46, 66],
      [6, 26, 48, 70],
      [6, 26, 50, 74],
      [6, 30, 54, 78],
      [6, 30, 56, 82],
      [6, 30, 58, 86],
      [6, 34, 62, 90],
      [6, 28, 50, 72, 94],
      [6, 26, 50, 74, 98],
      [6, 30, 54, 78, 102],
      [6, 28, 54, 80, 106],
      [6, 32, 58, 84, 110],
      [6, 30, 58, 86, 114],
      [6, 34, 62, 90, 118],
      [6, 26, 50, 74, 98, 122],
      [6, 30, 54, 78, 102, 126],
      [6, 26, 52, 78, 104, 130],
      [6, 30, 56, 82, 108, 134],
      [6, 34, 60, 86, 112, 138],
      [6, 30, 58, 86, 114, 142],
      [6, 34, 62, 90, 118, 146],
      [6, 30, 54, 78, 102, 126, 150],
      [6, 24, 50, 76, 102, 128, 154],
      [6, 28, 54, 80, 106, 132, 158],
      [6, 32, 58, 84, 110, 136, 162],
      [6, 26, 54, 82, 110, 138, 166],
      [6, 30, 58, 86, 114, 142, 170]
    ];
    var G15 = (1 << 10) | (1 << 8) | (1 << 5) | (1 << 4) | (1 << 2) | (1 << 1) | (1 << 0);
    var G18 = (1 << 12) | (1 << 11) | (1 << 10) | (1 << 9) | (1 << 8) | (1 << 5) | (1 << 2) | (1 << 0);
    var G15_MASK = (1 << 14) | (1 << 12) | (1 << 10) | (1 << 4) | (1 << 1);

    var _this = {};

    var getBCHDigit = function(data) {
      var digit = 0;
      while (data != 0) {
        digit += 1;
        data >>>= 1;
      }
      return digit;
    };

    _this.getBCHTypeInfo = function(data) {
      var d = data << 10;
      while (getBCHDigit(d) - getBCHDigit(G15) >= 0) {
        d ^= (G15 << (getBCHDigit(d) - getBCHDigit(G15) ) );
      }
      return ( (data << 10) | d) ^ G15_MASK;
    };

    _this.getBCHTypeNumber = function(data) {
      var d = data << 12;
      while (getBCHDigit(d) - getBCHDigit(G18) >= 0) {
        d ^= (G18 << (getBCHDigit(d) - getBCHDigit(G18) ) );
      }
      return (data << 12) | d;
    };

    _this.getPatternPosition = function(typeNumber) {
      return PATTERN_POSITION_TABLE[typeNumber - 1];
    };

    _this.getMaskFunction = function(maskPattern) {

      switch (maskPattern) {

      case QRMaskPattern.PATTERN000 :
        return function(i, j) { return (i + j) % 2 == 0; };
      case QRMaskPattern.PATTERN001 :
        return function(i, j) { return i % 2 == 0; };
      case QRMaskPattern.PATTERN010 :
        return function(i, j) { return j % 3 == 0; };
      case QRMaskPattern.PATTERN011 :
        return function(i, j) { return (i + j) % 3 == 0; };
      case QRMaskPattern.PATTERN100 :
        return function(i, j) { return (Math.floor(i / 2) + Math.floor(j / 3) ) % 2 == 0; };
      case QRMaskPattern.PATTERN101 :
        return function(i, j) { return (i * j) % 2 + (i * j) % 3 == 0; };
      case QRMaskPattern.PATTERN110 :
        return function(i, j) { return ( (i * j) % 2 + (i * j) % 3) % 2 == 0; };
      case QRMaskPattern.PATTERN111 :
        return function(i, j) { return ( (i * j) % 3 + (i + j) % 2) % 2 == 0; };

      default :
        throw 'bad maskPattern:' + maskPattern;
      }
    };

    _this.getErrorCorrectPolynomial = function(errorCorrectLength) {
      var a = qrPolynomial([1], 0);
      for (var i = 0; i < errorCorrectLength; i += 1) {
        a = a.multiply(qrPolynomial([1, QRMath.gexp(i)], 0) );
      }
      return a;
    };

    _this.getLengthInBits = function(mode, type) {

      if (1 <= type && type < 10) {

        // 1 - 9

        switch(mode) {
        case QRMode.MODE_NUMBER    : return 10;
        case QRMode.MODE_ALPHA_NUM : return 9;
        case QRMode.MODE_8BIT_BYTE : return 8;
        case QRMode.MODE_KANJI     : return 8;
        default :
          throw 'mode:' + mode;
        }

      } else if (type < 27) {

        // 10 - 26

        switch(mode) {
        case QRMode.MODE_NUMBER    : return 12;
        case QRMode.MODE_ALPHA_NUM : return 11;
        case QRMode.MODE_8BIT_BYTE : return 16;
        case QRMode.MODE_KANJI     : return 10;
        default :
          throw 'mode:' + mode;
        }

      } else if (type < 41) {

        // 27 - 40

        switch(mode) {
        case QRMode.MODE_NUMBER    : return 14;
        case QRMode.MODE_ALPHA_NUM : return 13;
        case QRMode.MODE_8BIT_BYTE : return 16;
        case QRMode.MODE_KANJI     : return 12;
        default :
          throw 'mode:' + mode;
        }

      } else {
        throw 'type:' + type;
      }
    };

    _this.getLostPoint = function(qrcode) {

      var moduleCount = qrcode.getModuleCount();

      var lostPoint = 0;

      // LEVEL1

      for (var row = 0; row < moduleCount; row += 1) {
        for (var col = 0; col < moduleCount; col += 1) {

          var sameCount = 0;
          var dark = qrcode.isDark(row, col);

          for (var r = -1; r <= 1; r += 1) {

            if (row + r < 0 || moduleCount <= row + r) {
              continue;
            }

            for (var c = -1; c <= 1; c += 1) {

              if (col + c < 0 || moduleCount <= col + c) {
                continue;
              }

              if (r == 0 && c == 0) {
                continue;
              }

              if (dark == qrcode.isDark(row + r, col + c) ) {
                sameCount += 1;
              }
            }
          }

          if (sameCount > 5) {
            lostPoint += (3 + sameCount - 5);
          }
        }
      };

      // LEVEL2

      for (var row = 0; row < moduleCount - 1; row += 1) {
        for (var col = 0; col < moduleCount - 1; col += 1) {
          var count = 0;
          if (qrcode.isDark(row, col) ) count += 1;
          if (qrcode.isDark(row + 1, col) ) count += 1;
          if (qrcode.isDark(row, col + 1) ) count += 1;
          if (qrcode.isDark(row + 1, col + 1) ) count += 1;
          if (count == 0 || count == 4) {
            lostPoint += 3;
          }
        }
      }

      // LEVEL3

      for (var row = 0; row < moduleCount; row += 1) {
        for (var col = 0; col < moduleCount - 6; col += 1) {
          if (qrcode.isDark(row, col)
              && !qrcode.isDark(row, col + 1)
              &&  qrcode.isDark(row, col + 2)
              &&  qrcode.isDark(row, col + 3)
              &&  qrcode.isDark(row, col + 4)
              && !qrcode.isDark(row, col + 5)
              &&  qrcode.isDark(row, col + 6) ) {
            lostPoint += 40;
          }
        }
      }

      for (var col = 0; col < moduleCount; col += 1) {
        for (var row = 0; row < moduleCount - 6; row += 1) {
          if (qrcode.isDark(row, col)
              && !qrcode.isDark(row + 1, col)
              &&  qrcode.isDark(row + 2, col)
              &&  qrcode.isDark(row + 3, col)
              &&  qrcode.isDark(row + 4, col)
              && !qrcode.isDark(row + 5, col)
              &&  qrcode.isDark(row + 6, col) ) {
            lostPoint += 40;
          }
        }
      }

      // LEVEL4

      var darkCount = 0;

      for (var col = 0; col < moduleCount; col += 1) {
        for (var row = 0; row < moduleCount; row += 1) {
          if (qrcode.isDark(row, col) ) {
            darkCount += 1;
          }
        }
      }

      var ratio = Math.abs(100 * darkCount / moduleCount / moduleCount - 50) / 5;
      lostPoint += ratio * 10;

      return lostPoint;
    };

    return _this;
  }();

  //---------------------------------------------------------------------
  // QRMath
  //---------------------------------------------------------------------

  var QRMath = function() {

    var EXP_TABLE = new Array(256);
    var LOG_TABLE = new Array(256);

    // initialize tables
    for (var i = 0; i < 8; i += 1) {
      EXP_TABLE[i] = 1 << i;
    }
    for (var i = 8; i < 256; i += 1) {
      EXP_TABLE[i] = EXP_TABLE[i - 4]
        ^ EXP_TABLE[i - 5]
        ^ EXP_TABLE[i - 6]
        ^ EXP_TABLE[i - 8];
    }
    for (var i = 0; i < 255; i += 1) {
      LOG_TABLE[EXP_TABLE[i] ] = i;
    }

    var _this = {};

    _this.glog = function(n) {

      if (n < 1) {
        throw 'glog(' + n + ')';
      }

      return LOG_TABLE[n];
    };

    _this.gexp = function(n) {

      while (n < 0) {
        n += 255;
      }

      while (n >= 256) {
        n -= 255;
      }

      return EXP_TABLE[n];
    };

    return _this;
  }();

  //---------------------------------------------------------------------
  // qrPolynomial
  //---------------------------------------------------------------------

  function qrPolynomial(num, shift) {

    if (typeof num.length == 'undefined') {
      throw num.length + '/' + shift;
    }

    var _num = function() {
      var offset = 0;
      while (offset < num.length && num[offset] == 0) {
        offset += 1;
      }
      var _num = new Array(num.length - offset + shift);
      for (var i = 0; i < num.length - offset; i += 1) {
        _num[i] = num[i + offset];
      }
      return _num;
    }();

    var _this = {};

    _this.getAt = function(index) {
      return _num[index];
    };

    _this.getLength = function() {
      return _num.length;
    };

    _this.multiply = function(e) {

      var num = new Array(_this.getLength() + e.getLength() - 1);

      for (var i = 0; i < _this.getLength(); i += 1) {
        for (var j = 0; j < e.getLength(); j += 1) {
          num[i + j] ^= QRMath.gexp(QRMath.glog(_this.getAt(i) ) + QRMath.glog(e.getAt(j) ) );
        }
      }

      return qrPolynomial(num, 0);
    };

    _this.mod = function(e) {

      if (_this.getLength() - e.getLength() < 0) {
        return _this;
      }

      var ratio = QRMath.glog(_this.getAt(0) ) - QRMath.glog(e.getAt(0) );

      var num = new Array(_this.getLength() );
      for (var i = 0; i < _this.getLength(); i += 1) {
        num[i] = _this.getAt(i);
      }

      for (var i = 0; i < e.getLength(); i += 1) {
        num[i] ^= QRMath.gexp(QRMath.glog(e.getAt(i) ) + ratio);
      }

      // recursive call
      return qrPolynomial(num, 0).mod(e);
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // QRRSBlock
  //---------------------------------------------------------------------

  var QRRSBlock = function() {

    var RS_BLOCK_TABLE = [

      // L
      // M
      // Q
      // H

      // 1
      [1, 26, 19],
      [1, 26, 16],
      [1, 26, 13],
      [1, 26, 9],

      // 2
      [1, 44, 34],
      [1, 44, 28],
      [1, 44, 22],
      [1, 44, 16],

      // 3
      [1, 70, 55],
      [1, 70, 44],
      [2, 35, 17],
      [2, 35, 13],

      // 4
      [1, 100, 80],
      [2, 50, 32],
      [2, 50, 24],
      [4, 25, 9],

      // 5
      [1, 134, 108],
      [2, 67, 43],
      [2, 33, 15, 2, 34, 16],
      [2, 33, 11, 2, 34, 12],

      // 6
      [2, 86, 68],
      [4, 43, 27],
      [4, 43, 19],
      [4, 43, 15],

      // 7
      [2, 98, 78],
      [4, 49, 31],
      [2, 32, 14, 4, 33, 15],
      [4, 39, 13, 1, 40, 14],

      // 8
      [2, 121, 97],
      [2, 60, 38, 2, 61, 39],
      [4, 40, 18, 2, 41, 19],
      [4, 40, 14, 2, 41, 15],

      // 9
      [2, 146, 116],
      [3, 58, 36, 2, 59, 37],
      [4, 36, 16, 4, 37, 17],
      [4, 36, 12, 4, 37, 13],

      // 10
      [2, 86, 68, 2, 87, 69],
      [4, 69, 43, 1, 70, 44],
      [6, 43, 19, 2, 44, 20],
      [6, 43, 15, 2, 44, 16],

      // 11
      [4, 101, 81],
      [1, 80, 50, 4, 81, 51],
      [4, 50, 22, 4, 51, 23],
      [3, 36, 12, 8, 37, 13],

      // 12
      [2, 116, 92, 2, 117, 93],
      [6, 58, 36, 2, 59, 37],
      [4, 46, 20, 6, 47, 21],
      [7, 42, 14, 4, 43, 15],

      // 13
      [4, 133, 107],
      [8, 59, 37, 1, 60, 38],
      [8, 44, 20, 4, 45, 21],
      [12, 33, 11, 4, 34, 12],

      // 14
      [3, 145, 115, 1, 146, 116],
      [4, 64, 40, 5, 65, 41],
      [11, 36, 16, 5, 37, 17],
      [11, 36, 12, 5, 37, 13],

      // 15
      [5, 109, 87, 1, 110, 88],
      [5, 65, 41, 5, 66, 42],
      [5, 54, 24, 7, 55, 25],
      [11, 36, 12, 7, 37, 13],

      // 16
      [5, 122, 98, 1, 123, 99],
      [7, 73, 45, 3, 74, 46],
      [15, 43, 19, 2, 44, 20],
      [3, 45, 15, 13, 46, 16],

      // 17
      [1, 135, 107, 5, 136, 108],
      [10, 74, 46, 1, 75, 47],
      [1, 50, 22, 15, 51, 23],
      [2, 42, 14, 17, 43, 15],

      // 18
      [5, 150, 120, 1, 151, 121],
      [9, 69, 43, 4, 70, 44],
      [17, 50, 22, 1, 51, 23],
      [2, 42, 14, 19, 43, 15],

      // 19
      [3, 141, 113, 4, 142, 114],
      [3, 70, 44, 11, 71, 45],
      [17, 47, 21, 4, 48, 22],
      [9, 39, 13, 16, 40, 14],

      // 20
      [3, 135, 107, 5, 136, 108],
      [3, 67, 41, 13, 68, 42],
      [15, 54, 24, 5, 55, 25],
      [15, 43, 15, 10, 44, 16],

      // 21
      [4, 144, 116, 4, 145, 117],
      [17, 68, 42],
      [17, 50, 22, 6, 51, 23],
      [19, 46, 16, 6, 47, 17],

      // 22
      [2, 139, 111, 7, 140, 112],
      [17, 74, 46],
      [7, 54, 24, 16, 55, 25],
      [34, 37, 13],

      // 23
      [4, 151, 121, 5, 152, 122],
      [4, 75, 47, 14, 76, 48],
      [11, 54, 24, 14, 55, 25],
      [16, 45, 15, 14, 46, 16],

      // 24
      [6, 147, 117, 4, 148, 118],
      [6, 73, 45, 14, 74, 46],
      [11, 54, 24, 16, 55, 25],
      [30, 46, 16, 2, 47, 17],

      // 25
      [8, 132, 106, 4, 133, 107],
      [8, 75, 47, 13, 76, 48],
      [7, 54, 24, 22, 55, 25],
      [22, 45, 15, 13, 46, 16],

      // 26
      [10, 142, 114, 2, 143, 115],
      [19, 74, 46, 4, 75, 47],
      [28, 50, 22, 6, 51, 23],
      [33, 46, 16, 4, 47, 17],

      // 27
      [8, 152, 122, 4, 153, 123],
      [22, 73, 45, 3, 74, 46],
      [8, 53, 23, 26, 54, 24],
      [12, 45, 15, 28, 46, 16],

      // 28
      [3, 147, 117, 10, 148, 118],
      [3, 73, 45, 23, 74, 46],
      [4, 54, 24, 31, 55, 25],
      [11, 45, 15, 31, 46, 16],

      // 29
      [7, 146, 116, 7, 147, 117],
      [21, 73, 45, 7, 74, 46],
      [1, 53, 23, 37, 54, 24],
      [19, 45, 15, 26, 46, 16],

      // 30
      [5, 145, 115, 10, 146, 116],
      [19, 75, 47, 10, 76, 48],
      [15, 54, 24, 25, 55, 25],
      [23, 45, 15, 25, 46, 16],

      // 31
      [13, 145, 115, 3, 146, 116],
      [2, 74, 46, 29, 75, 47],
      [42, 54, 24, 1, 55, 25],
      [23, 45, 15, 28, 46, 16],

      // 32
      [17, 145, 115],
      [10, 74, 46, 23, 75, 47],
      [10, 54, 24, 35, 55, 25],
      [19, 45, 15, 35, 46, 16],

      // 33
      [17, 145, 115, 1, 146, 116],
      [14, 74, 46, 21, 75, 47],
      [29, 54, 24, 19, 55, 25],
      [11, 45, 15, 46, 46, 16],

      // 34
      [13, 145, 115, 6, 146, 116],
      [14, 74, 46, 23, 75, 47],
      [44, 54, 24, 7, 55, 25],
      [59, 46, 16, 1, 47, 17],

      // 35
      [12, 151, 121, 7, 152, 122],
      [12, 75, 47, 26, 76, 48],
      [39, 54, 24, 14, 55, 25],
      [22, 45, 15, 41, 46, 16],

      // 36
      [6, 151, 121, 14, 152, 122],
      [6, 75, 47, 34, 76, 48],
      [46, 54, 24, 10, 55, 25],
      [2, 45, 15, 64, 46, 16],

      // 37
      [17, 152, 122, 4, 153, 123],
      [29, 74, 46, 14, 75, 47],
      [49, 54, 24, 10, 55, 25],
      [24, 45, 15, 46, 46, 16],

      // 38
      [4, 152, 122, 18, 153, 123],
      [13, 74, 46, 32, 75, 47],
      [48, 54, 24, 14, 55, 25],
      [42, 45, 15, 32, 46, 16],

      // 39
      [20, 147, 117, 4, 148, 118],
      [40, 75, 47, 7, 76, 48],
      [43, 54, 24, 22, 55, 25],
      [10, 45, 15, 67, 46, 16],

      // 40
      [19, 148, 118, 6, 149, 119],
      [18, 75, 47, 31, 76, 48],
      [34, 54, 24, 34, 55, 25],
      [20, 45, 15, 61, 46, 16]
    ];

    var qrRSBlock = function(totalCount, dataCount) {
      var _this = {};
      _this.totalCount = totalCount;
      _this.dataCount = dataCount;
      return _this;
    };

    var _this = {};

    var getRsBlockTable = function(typeNumber, errorCorrectionLevel) {

      switch(errorCorrectionLevel) {
      case QRErrorCorrectionLevel.L :
        return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 0];
      case QRErrorCorrectionLevel.M :
        return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 1];
      case QRErrorCorrectionLevel.Q :
        return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 2];
      case QRErrorCorrectionLevel.H :
        return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 3];
      default :
        return undefined;
      }
    };

    _this.getRSBlocks = function(typeNumber, errorCorrectionLevel) {

      var rsBlock = getRsBlockTable(typeNumber, errorCorrectionLevel);

      if (typeof rsBlock == 'undefined') {
        throw 'bad rs block @ typeNumber:' + typeNumber +
            '/errorCorrectionLevel:' + errorCorrectionLevel;
      }

      var length = rsBlock.length / 3;

      var list = [];

      for (var i = 0; i < length; i += 1) {

        var count = rsBlock[i * 3 + 0];
        var totalCount = rsBlock[i * 3 + 1];
        var dataCount = rsBlock[i * 3 + 2];

        for (var j = 0; j < count; j += 1) {
          list.push(qrRSBlock(totalCount, dataCount) );
        }
      }

      return list;
    };

    return _this;
  }();

  //---------------------------------------------------------------------
  // qrBitBuffer
  //---------------------------------------------------------------------

  var qrBitBuffer = function() {

    var _buffer = [];
    var _length = 0;

    var _this = {};

    _this.getBuffer = function() {
      return _buffer;
    };

    _this.getAt = function(index) {
      var bufIndex = Math.floor(index / 8);
      return ( (_buffer[bufIndex] >>> (7 - index % 8) ) & 1) == 1;
    };

    _this.put = function(num, length) {
      for (var i = 0; i < length; i += 1) {
        _this.putBit( ( (num >>> (length - i - 1) ) & 1) == 1);
      }
    };

    _this.getLengthInBits = function() {
      return _length;
    };

    _this.putBit = function(bit) {

      var bufIndex = Math.floor(_length / 8);
      if (_buffer.length <= bufIndex) {
        _buffer.push(0);
      }

      if (bit) {
        _buffer[bufIndex] |= (0x80 >>> (_length % 8) );
      }

      _length += 1;
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // qrNumber
  //---------------------------------------------------------------------

  var qrNumber = function(data) {

    var _mode = QRMode.MODE_NUMBER;
    var _data = data;

    var _this = {};

    _this.getMode = function() {
      return _mode;
    };

    _this.getLength = function(buffer) {
      return _data.length;
    };

    _this.write = function(buffer) {

      var data = _data;

      var i = 0;

      while (i + 2 < data.length) {
        buffer.put(strToNum(data.substring(i, i + 3) ), 10);
        i += 3;
      }

      if (i < data.length) {
        if (data.length - i == 1) {
          buffer.put(strToNum(data.substring(i, i + 1) ), 4);
        } else if (data.length - i == 2) {
          buffer.put(strToNum(data.substring(i, i + 2) ), 7);
        }
      }
    };

    var strToNum = function(s) {
      var num = 0;
      for (var i = 0; i < s.length; i += 1) {
        num = num * 10 + chatToNum(s.charAt(i) );
      }
      return num;
    };

    var chatToNum = function(c) {
      if ('0' <= c && c <= '9') {
        return c.charCodeAt(0) - '0'.charCodeAt(0);
      }
      throw 'illegal char :' + c;
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // qrAlphaNum
  //---------------------------------------------------------------------

  var qrAlphaNum = function(data) {

    var _mode = QRMode.MODE_ALPHA_NUM;
    var _data = data;

    var _this = {};

    _this.getMode = function() {
      return _mode;
    };

    _this.getLength = function(buffer) {
      return _data.length;
    };

    _this.write = function(buffer) {

      var s = _data;

      var i = 0;

      while (i + 1 < s.length) {
        buffer.put(
          getCode(s.charAt(i) ) * 45 +
          getCode(s.charAt(i + 1) ), 11);
        i += 2;
      }

      if (i < s.length) {
        buffer.put(getCode(s.charAt(i) ), 6);
      }
    };

    var getCode = function(c) {

      if ('0' <= c && c <= '9') {
        return c.charCodeAt(0) - '0'.charCodeAt(0);
      } else if ('A' <= c && c <= 'Z') {
        return c.charCodeAt(0) - 'A'.charCodeAt(0) + 10;
      } else {
        switch (c) {
        case ' ' : return 36;
        case '$' : return 37;
        case '%' : return 38;
        case '*' : return 39;
        case '+' : return 40;
        case '-' : return 41;
        case '.' : return 42;
        case '/' : return 43;
        case ':' : return 44;
        default :
          throw 'illegal char :' + c;
        }
      }
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // qr8BitByte
  //---------------------------------------------------------------------

  var qr8BitByte = function(data) {

    var _mode = QRMode.MODE_8BIT_BYTE;
    var _data = data;
    var _bytes = qrcode.stringToBytes(data);

    var _this = {};

    _this.getMode = function() {
      return _mode;
    };

    _this.getLength = function(buffer) {
      return _bytes.length;
    };

    _this.write = function(buffer) {
      for (var i = 0; i < _bytes.length; i += 1) {
        buffer.put(_bytes[i], 8);
      }
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // qrKanji
  //---------------------------------------------------------------------

  var qrKanji = function(data) {

    var _mode = QRMode.MODE_KANJI;
    var _data = data;

    var stringToBytes = qrcode.stringToBytesFuncs['SJIS'];
    if (!stringToBytes) {
      throw 'sjis not supported.';
    }
    !function(c, code) {
      // self test for sjis support.
      var test = stringToBytes(c);
      if (test.length != 2 || ( (test[0] << 8) | test[1]) != code) {
        throw 'sjis not supported.';
      }
    }('\u53cb', 0x9746);

    var _bytes = stringToBytes(data);

    var _this = {};

    _this.getMode = function() {
      return _mode;
    };

    _this.getLength = function(buffer) {
      return ~~(_bytes.length / 2);
    };

    _this.write = function(buffer) {

      var data = _bytes;

      var i = 0;

      while (i + 1 < data.length) {

        var c = ( (0xff & data[i]) << 8) | (0xff & data[i + 1]);

        if (0x8140 <= c && c <= 0x9FFC) {
          c -= 0x8140;
        } else if (0xE040 <= c && c <= 0xEBBF) {
          c -= 0xC140;
        } else {
          throw 'illegal char at ' + (i + 1) + '/' + c;
        }

        c = ( (c >>> 8) & 0xff) * 0xC0 + (c & 0xff);

        buffer.put(c, 13);

        i += 2;
      }

      if (i < data.length) {
        throw 'illegal char at ' + (i + 1);
      }
    };

    return _this;
  };

  //=====================================================================
  // GIF Support etc.
  //

  //---------------------------------------------------------------------
  // byteArrayOutputStream
  //---------------------------------------------------------------------

  var byteArrayOutputStream = function() {

    var _bytes = [];

    var _this = {};

    _this.writeByte = function(b) {
      _bytes.push(b & 0xff);
    };

    _this.writeShort = function(i) {
      _this.writeByte(i);
      _this.writeByte(i >>> 8);
    };

    _this.writeBytes = function(b, off, len) {
      off = off || 0;
      len = len || b.length;
      for (var i = 0; i < len; i += 1) {
        _this.writeByte(b[i + off]);
      }
    };

    _this.writeString = function(s) {
      for (var i = 0; i < s.length; i += 1) {
        _this.writeByte(s.charCodeAt(i) );
      }
    };

    _this.toByteArray = function() {
      return _bytes;
    };

    _this.toString = function() {
      var s = '';
      s += '[';
      for (var i = 0; i < _bytes.length; i += 1) {
        if (i > 0) {
          s += ',';
        }
        s += _bytes[i];
      }
      s += ']';
      return s;
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // base64EncodeOutputStream
  //---------------------------------------------------------------------

  var base64EncodeOutputStream = function() {

    var _buffer = 0;
    var _buflen = 0;
    var _length = 0;
    var _base64 = '';

    var _this = {};

    var writeEncoded = function(b) {
      _base64 += String.fromCharCode(encode(b & 0x3f) );
    };

    var encode = function(n) {
      if (n < 0) {
        // error.
      } else if (n < 26) {
        return 0x41 + n;
      } else if (n < 52) {
        return 0x61 + (n - 26);
      } else if (n < 62) {
        return 0x30 + (n - 52);
      } else if (n == 62) {
        return 0x2b;
      } else if (n == 63) {
        return 0x2f;
      }
      throw 'n:' + n;
    };

    _this.writeByte = function(n) {

      _buffer = (_buffer << 8) | (n & 0xff);
      _buflen += 8;
      _length += 1;

      while (_buflen >= 6) {
        writeEncoded(_buffer >>> (_buflen - 6) );
        _buflen -= 6;
      }
    };

    _this.flush = function() {

      if (_buflen > 0) {
        writeEncoded(_buffer << (6 - _buflen) );
        _buffer = 0;
        _buflen = 0;
      }

      if (_length % 3 != 0) {
        // padding
        var padlen = 3 - _length % 3;
        for (var i = 0; i < padlen; i += 1) {
          _base64 += '=';
        }
      }
    };

    _this.toString = function() {
      return _base64;
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // base64DecodeInputStream
  //---------------------------------------------------------------------

  var base64DecodeInputStream = function(str) {

    var _str = str;
    var _pos = 0;
    var _buffer = 0;
    var _buflen = 0;

    var _this = {};

    _this.read = function() {

      while (_buflen < 8) {

        if (_pos >= _str.length) {
          if (_buflen == 0) {
            return -1;
          }
          throw 'unexpected end of file./' + _buflen;
        }

        var c = _str.charAt(_pos);
        _pos += 1;

        if (c == '=') {
          _buflen = 0;
          return -1;
        } else if (c.match(/^\s$/) ) {
          // ignore if whitespace.
          continue;
        }

        _buffer = (_buffer << 6) | decode(c.charCodeAt(0) );
        _buflen += 6;
      }

      var n = (_buffer >>> (_buflen - 8) ) & 0xff;
      _buflen -= 8;
      return n;
    };

    var decode = function(c) {
      if (0x41 <= c && c <= 0x5a) {
        return c - 0x41;
      } else if (0x61 <= c && c <= 0x7a) {
        return c - 0x61 + 26;
      } else if (0x30 <= c && c <= 0x39) {
        return c - 0x30 + 52;
      } else if (c == 0x2b) {
        return 62;
      } else if (c == 0x2f) {
        return 63;
      } else {
        throw 'c:' + c;
      }
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // gifImage (B/W)
  //---------------------------------------------------------------------

  var gifImage = function(width, height) {

    var _width = width;
    var _height = height;
    var _data = new Array(width * height);

    var _this = {};

    _this.setPixel = function(x, y, pixel) {
      _data[y * _width + x] = pixel;
    };

    _this.write = function(out) {

      //---------------------------------
      // GIF Signature

      out.writeString('GIF87a');

      //---------------------------------
      // Screen Descriptor

      out.writeShort(_width);
      out.writeShort(_height);

      out.writeByte(0x80); // 2bit
      out.writeByte(0);
      out.writeByte(0);

      //---------------------------------
      // Global Color Map

      // black
      out.writeByte(0x00);
      out.writeByte(0x00);
      out.writeByte(0x00);

      // white
      out.writeByte(0xff);
      out.writeByte(0xff);
      out.writeByte(0xff);

      //---------------------------------
      // Image Descriptor

      out.writeString(',');
      out.writeShort(0);
      out.writeShort(0);
      out.writeShort(_width);
      out.writeShort(_height);
      out.writeByte(0);

      //---------------------------------
      // Local Color Map

      //---------------------------------
      // Raster Data

      var lzwMinCodeSize = 2;
      var raster = getLZWRaster(lzwMinCodeSize);

      out.writeByte(lzwMinCodeSize);

      var offset = 0;

      while (raster.length - offset > 255) {
        out.writeByte(255);
        out.writeBytes(raster, offset, 255);
        offset += 255;
      }

      out.writeByte(raster.length - offset);
      out.writeBytes(raster, offset, raster.length - offset);
      out.writeByte(0x00);

      //---------------------------------
      // GIF Terminator
      out.writeString(';');
    };

    var bitOutputStream = function(out) {

      var _out = out;
      var _bitLength = 0;
      var _bitBuffer = 0;

      var _this = {};

      _this.write = function(data, length) {

        if ( (data >>> length) != 0) {
          throw 'length over';
        }

        while (_bitLength + length >= 8) {
          _out.writeByte(0xff & ( (data << _bitLength) | _bitBuffer) );
          length -= (8 - _bitLength);
          data >>>= (8 - _bitLength);
          _bitBuffer = 0;
          _bitLength = 0;
        }

        _bitBuffer = (data << _bitLength) | _bitBuffer;
        _bitLength = _bitLength + length;
      };

      _this.flush = function() {
        if (_bitLength > 0) {
          _out.writeByte(_bitBuffer);
        }
      };

      return _this;
    };

    var getLZWRaster = function(lzwMinCodeSize) {

      var clearCode = 1 << lzwMinCodeSize;
      var endCode = (1 << lzwMinCodeSize) + 1;
      var bitLength = lzwMinCodeSize + 1;

      // Setup LZWTable
      var table = lzwTable();

      for (var i = 0; i < clearCode; i += 1) {
        table.add(String.fromCharCode(i) );
      }
      table.add(String.fromCharCode(clearCode) );
      table.add(String.fromCharCode(endCode) );

      var byteOut = byteArrayOutputStream();
      var bitOut = bitOutputStream(byteOut);

      // clear code
      bitOut.write(clearCode, bitLength);

      var dataIndex = 0;

      var s = String.fromCharCode(_data[dataIndex]);
      dataIndex += 1;

      while (dataIndex < _data.length) {

        var c = String.fromCharCode(_data[dataIndex]);
        dataIndex += 1;

        if (table.contains(s + c) ) {

          s = s + c;

        } else {

          bitOut.write(table.indexOf(s), bitLength);

          if (table.size() < 0xfff) {

            if (table.size() == (1 << bitLength) ) {
              bitLength += 1;
            }

            table.add(s + c);
          }

          s = c;
        }
      }

      bitOut.write(table.indexOf(s), bitLength);

      // end code
      bitOut.write(endCode, bitLength);

      bitOut.flush();

      return byteOut.toByteArray();
    };

    var lzwTable = function() {

      var _map = {};
      var _size = 0;

      var _this = {};

      _this.add = function(key) {
        if (_this.contains(key) ) {
          throw 'dup key:' + key;
        }
        _map[key] = _size;
        _size += 1;
      };

      _this.size = function() {
        return _size;
      };

      _this.indexOf = function(key) {
        return _map[key];
      };

      _this.contains = function(key) {
        return typeof _map[key] != 'undefined';
      };

      return _this;
    };

    return _this;
  };

  var createDataURL = function(width, height, getPixel) {
    var gif = gifImage(width, height);
    for (var y = 0; y < height; y += 1) {
      for (var x = 0; x < width; x += 1) {
        gif.setPixel(x, y, getPixel(x, y) );
      }
    }

    var b = byteArrayOutputStream();
    gif.write(b);

    var base64 = base64EncodeOutputStream();
    var bytes = b.toByteArray();
    for (var i = 0; i < bytes.length; i += 1) {
      base64.writeByte(bytes[i]);
    }
    base64.flush();

    return 'data:image/gif;base64,' + base64;
  };

  //---------------------------------------------------------------------
  // returns qrcode function.

  return qrcode;
}();

// multibyte support
!function() {

  qrcode.stringToBytesFuncs['UTF-8'] = function(s) {
    // http://stackoverflow.com/questions/18729405/how-to-convert-utf8-string-to-byte-array
    function toUTF8Array(str) {
      var utf8 = [];
      for (var i=0; i < str.length; i++) {
        var charcode = str.charCodeAt(i);
        if (charcode < 0x80) utf8.push(charcode);
        else if (charcode < 0x800) {
          utf8.push(0xc0 | (charcode >> 6),
              0x80 | (charcode & 0x3f));
        }
        else if (charcode < 0xd800 || charcode >= 0xe000) {
          utf8.push(0xe0 | (charcode >> 12),
              0x80 | ((charcode>>6) & 0x3f),
              0x80 | (charcode & 0x3f));
        }
        // surrogate pair
        else {
          i++;
          // UTF-16 encodes 0x10000-0x10FFFF by
          // subtracting 0x10000 and splitting the
          // 20 bits of 0x0-0xFFFFF into two halves
          charcode = 0x10000 + (((charcode & 0x3ff)<<10)
            | (str.charCodeAt(i) & 0x3ff));
          utf8.push(0xf0 | (charcode >>18),
              0x80 | ((charcode>>12) & 0x3f),
              0x80 | ((charcode>>6) & 0x3f),
              0x80 | (charcode & 0x3f));
        }
      }
      return utf8;
    }
    return toUTF8Array(s);
  };

}();

(function (factory) {
  if (typeof define === 'function' && define.amd) {
      define([], factory);
  } else if (typeof exports === 'object') {
      module.exports = factory();
  }
}(function () {
    return qrcode;
}));


  return module.exports;
})();

/* EMBEDDED_ASR_BRIDGE_START */
const ASR_BRIDGE_B64 = "IyEvdXNyL2Jpbi9lbnYgcHl0aG9uMwojIC0qLSBjb2Rpbmc6IHV0Zi04IC0qLQoiIiJhc3JfYnJpZGdlLnB5IOKAlCDnu5kgT2JzaWRpYW4g5o+S5Lu255So55qE5pys5Zyw6L2s5b2V5qGl44CCCgrnlKjms5XvvJoKICBweXRob24gYXNyX2JyaWRnZS5weSAtLXVybCA86KeG6aKR6ZO+5o6lPiBbLS1tb2RlbCBzbWFsbF0gWy0tbGFuZ3VhZ2UgemhdIFstLXl0ZGxwIHl0LWRscF0KCui+k+WHuu+8iHN0ZG91dCDmnIDlkI7kuIDooYzvvInvvJp7InNlZ21lbnRzIjogW1vnp5IsICLmlofmnKwiXSwgLi4uXSwgImxhbmd1YWdlIjogInpoIiwgImR1cmF0aW9uIjogMjk0LjN9CuaXpeW/l+S4gOW+i+i1sCBzdGRlcnLvvIzkuI3lvbHlk43mj5Lku7bop6PmnpDjgIIKIiIiCmltcG9ydCBhcmdwYXJzZQppbXBvcnQganNvbgppbXBvcnQgb3MKaW1wb3J0IHJlCmltcG9ydCBzaHV0aWwKaW1wb3J0IHN1YnByb2Nlc3MKaW1wb3J0IHN5cwppbXBvcnQgdGVtcGZpbGUKCm9zLmVudmlyb24uc2V0ZGVmYXVsdCgiSEZfRU5EUE9JTlQiLCAiaHR0cHM6Ly9oZi1taXJyb3IuY29tIikKb3MuZW52aXJvbi5zZXRkZWZhdWx0KCJIRl9IVUJfT0ZGTElORSIsICIwIikKCnRyeToKICAgIHN5cy5zdGRvdXQucmVjb25maWd1cmUoZW5jb2Rpbmc9InV0Zi04IikKICAgIHN5cy5zdGRlcnIucmVjb25maWd1cmUoZW5jb2Rpbmc9InV0Zi04IikKZXhjZXB0IEV4Y2VwdGlvbjoKICAgIHBhc3MKCgpkZWYgbG9nKG1zZyk6CiAgICBwcmludChtc2csIGZpbGU9c3lzLnN0ZGVyciwgZmx1c2g9VHJ1ZSkKCgpkZWYgcnVuX2J5dGVzKGNtZCwgdGltZW91dD0xODAwKToKICAgIGxvZygiJCAiICsgIiAiLmpvaW4oY21kKSkKICAgIHJldHVybiBzdWJwcm9jZXNzLnJ1bihjbWQsIGNhcHR1cmVfb3V0cHV0PVRydWUsIHRpbWVvdXQ9dGltZW91dCkKCgpkZWYgZG93bmxvYWRfYXVkaW8odXJsLCB5dGRscCwgdG1wLCBjb29raWU9IiIpOgogICAgb3V0ID0gc3RyKHRtcCAvICJhdWRpby4lKGV4dClzIikKICAgIGNtZCA9IFt5dGRscCwgIi1mIiwgImJlc3RhdWRpb1tleHQ9bTRhXS9iZXN0YXVkaW8vYmVzdCIsCiAgICAgICAgICAgIi0tbm8td2FybmluZ3MiLCAiLS1uby1wbGF5bGlzdCJdCiAgICBpZiBjb29raWU6CiAgICAgICAgY21kICs9IFsiLS1hZGQtaGVhZGVyIiwgZiJDb29raWU6IHtjb29raWV9Il0KICAgIGNtZCArPSBbIi1vIiwgb3V0LCB1cmxdCiAgICBwID0gcnVuX2J5dGVzKGNtZCkKICAgIGZpbGVzID0gW2YgZm9yIGYgaW4gdG1wLmdsb2IoImF1ZGlvLioiKSBpZiBmLmlzX2ZpbGUoKV0KICAgIGlmIG5vdCBmaWxlczoKICAgICAgICByYWlzZSBSdW50aW1lRXJyb3IoIumfs+mikeS4i+i9veWksei0pTogIiArIChwLnN0ZGVyciBvciBiIiIpLmRlY29kZSgidXRmLTgiLCAicmVwbGFjZSIpWy01MDA6XSkKICAgIHJldHVybiBmaWxlc1swXQoKCiMg5oqW6Z+z6L+Z57G75bmz5Y+w5rKh5pyJ5bmz5Y+w5a2X5bmV44CB5Lmf5LiN57uZIHl0LWRscCDmipPvvIjopoHmlrDpspwgQ29va2ll77yJ77yMCiMg5pKt5pS+5Zmo6YeM6IO955u05o6l5ou/5YiwIENETiDnm7Tpk77vvIzov5nph4zlsLHnlKggdXJsbGliIOebtOS4i++8jOe7leW8gCB5dC1kbHDjgIIKRElSRUNUX01FRElBX1JFID0gcmUuY29tcGlsZShyIlwuKG1wNHxtNGF8bXAzfHdlYm18YWFjfG00cykoXD98JCkiLCByZS5JKQoKCmRlZiBkb3dubG9hZF9kaXJlY3QodXJsLCB0bXAsIHJlZmVyZXI9Imh0dHBzOi8vd3d3LmRvdXlpbi5jb20vIik6CiAgICBpbXBvcnQgdXJsbGliLnJlcXVlc3QKCiAgICBvdXQgPSB0bXAgLyAiYXVkaW8ubXA0IgogICAgcmVxID0gdXJsbGliLnJlcXVlc3QuUmVxdWVzdCh1cmwsIGhlYWRlcnM9ewogICAgICAgICJVc2VyLUFnZW50IjogKCJNb3ppbGxhLzUuMCAoV2luZG93cyBOVCAxMC4wOyBXaW42NDsgeDY0KSBBcHBsZVdlYktpdC81MzcuMzYgIgogICAgICAgICAgICAgICAgICAgICAgICIoS0hUTUwsIGxpa2UgR2Vja28pIENocm9tZS8xNDAuMC4wLjAgU2FmYXJpLzUzNy4zNiIpLAogICAgICAgICJSZWZlcmVyIjogcmVmZXJlciBvciAiaHR0cHM6Ly93d3cuZG91eWluLmNvbS8iLAogICAgICAgICJBY2NlcHQiOiAiKi8qIiwKICAgIH0pCiAgICBsb2coZiIkIEdFVCB7dXJsWzoxMjBdfeKApiIpCiAgICB3aXRoIHVybGxpYi5yZXF1ZXN0LnVybG9wZW4ocmVxLCB0aW1lb3V0PTE4MCkgYXMgcmVzcCwgb3BlbihvdXQsICJ3YiIpIGFzIGY6CiAgICAgICAgc2h1dGlsLmNvcHlmaWxlb2JqKHJlc3AsIGYpCiAgICBpZiBvdXQuc3RhdCgpLnN0X3NpemUgPCAxMCAqIDEwMjQ6CiAgICAgICAgcmFpc2UgUnVudGltZUVycm9yKCLnm7Tpk77kuIvovb3nmoTmlofku7blpKrlsI/vvIzlj6/og73mmK/pmLLnm5fpk77miJblt7Lov4fmnJ8iKQogICAgcmV0dXJuIG91dAoKCmRlZiBsb2FkX2F1ZGlvKHBhdGgsIHNyPTE2MDAwKToKICAgIGltcG9ydCBudW1weSBhcyBucAogICAgcCA9IHJ1bl9ieXRlcyhbImZmbXBlZyIsICItbm9zdGRpbiIsICItaGlkZV9iYW5uZXIiLCAiLWxvZ2xldmVsIiwgImVycm9yIiwKICAgICAgICAgICAgICAgICAgICItaSIsIHN0cihwYXRoKSwgIi1mIiwgInMxNmxlIiwgIi1hYyIsICIxIiwgIi1hciIsIHN0cihzciksICItIl0pCiAgICBpZiBwLnJldHVybmNvZGUgIT0gMCBvciBub3QgcC5zdGRvdXQ6CiAgICAgICAgcmFpc2UgUnVudGltZUVycm9yKCJmZm1wZWcg6Kej56CB5aSx6LSlOiAiICsgKHAuc3RkZXJyIG9yIGIiIikuZGVjb2RlKCJ1dGYtOCIsICJyZXBsYWNlIilbLTQwMDpdKQogICAgcmV0dXJuIG5wLmZyb21idWZmZXIocC5zdGRvdXQsIGR0eXBlPW5wLmludDE2KS5hc3R5cGUoImZsb2F0MzIiKSAvIDMyNzY4LjAKCgp0cnk6CiAgICBmcm9tIG9wZW5jYyBpbXBvcnQgT3BlbkNDCiAgICBUMlMgPSBPcGVuQ0MoInQycyIpCmV4Y2VwdCBFeGNlcHRpb246CiAgICBUMlMgPSBOb25lCgoKZGVmIHNpbXBsaWZpZWQodGV4dCk6CiAgICAiIiJXaGlzcGVyIOWcqOS4reaWh+WPo+mfsy/kuK3oi7Hmt7for7Tml7blj6/og73lkJDlh7rnuYHkvZPvvIznu5/kuIDovaznroDkvZPjgIIiIiIKICAgIGlmIG5vdCB0ZXh0OgogICAgICAgIHJldHVybiB0ZXh0CiAgICByZXR1cm4gVDJTLmNvbnZlcnQodGV4dCkgaWYgVDJTIGVsc2UgdGV4dAoKCk5PSVNFX1JFID0gcmUuY29tcGlsZShyIl5bXHPimarwn461KlxbXCjvvIhdKihtdXNpY3zpn7PkuZB8YXBwbGF1c2V85o6M5aOwfOmdmemfs3xzaWxlbmNlKVtcc+KZqvCfjrUqXF1cKe+8iV0qJCIsIHJlLkkpCgoKZGVmIGRyb3Bfbm9pc2UoaXRlbXMpOgogICAgIiIid2hpc3BlciDlr7nnuq/pn7PkuZDop4bpopHkvJrlkJDlh7ogIk11c2ljIiDov5nnsbvmoIfnrb7vvIzkuI3og73lvZPovazlvZXnlKjjgIIiIiIKICAgIG91dCA9IFtdCiAgICBmb3Igc3RhcnQsIHRleHQgaW4gaXRlbXM6CiAgICAgICAgdCA9ICh0ZXh0IG9yICIiKS5zdHJpcCgpCiAgICAgICAgaWYgbm90IHQgb3IgTk9JU0VfUkUubWF0Y2godCk6CiAgICAgICAgICAgIGNvbnRpbnVlCiAgICAgICAgb3V0LmFwcGVuZChbc3RhcnQsIHRdKQogICAgcmV0dXJuIG91dAoKCmRlZiBtZXJnZShpdGVtcywgbWluX2NoYXJzPTI0LCBtYXhfZ2FwPTguMCwgbWF4X2NoYXJzPTE0MCk6CiAgICBvdXQgPSBbXQogICAgZm9yIHN0YXJ0LCB0ZXh0IGluIGl0ZW1zOgogICAgICAgIGlmIG91dDoKICAgICAgICAgICAgbHMsIGx0ID0gb3V0Wy0xXQogICAgICAgICAgICBlbmRlZCA9IGJvb2wocmUuc2VhcmNoKHIiW+OAgu+8n++8gT8hLu+8mztdJCIsIGx0KSkgYW5kIGxlbihsdCkgPj0gbWluX2NoYXJzCiAgICAgICAgICAgIGlmIChub3QgZW5kZWQgYW5kIGxlbihsdCkgPCBtYXhfY2hhcnMgYW5kIGxlbihsdCkgPCBtaW5fY2hhcnMgKiA0CiAgICAgICAgICAgICAgICAgICAgYW5kIHN0YXJ0IC0gbHMgPD0gbWF4X2dhcCBhbmQgbGVuKGx0KSArIGxlbih0ZXh0KSA8PSBtYXhfY2hhcnMpOgogICAgICAgICAgICAgICAgb3V0Wy0xXSA9IFtscywgKGx0ICsgIiAiICsgdGV4dCkuc3RyaXAoKV0KICAgICAgICAgICAgICAgIGNvbnRpbnVlCiAgICAgICAgb3V0LmFwcGVuZChbc3RhcnQsIHRleHRdKQogICAgcmV0dXJuIG91dAoKCmRlZiBtYWluKCk6CiAgICBhcCA9IGFyZ3BhcnNlLkFyZ3VtZW50UGFyc2VyKCkKICAgIGFwLmFkZF9hcmd1bWVudCgiLS11cmwiLCByZXF1aXJlZD1UcnVlKQogICAgYXAuYWRkX2FyZ3VtZW50KCItLW1vZGVsIiwgZGVmYXVsdD0ic21hbGwiKQogICAgYXAuYWRkX2FyZ3VtZW50KCItLWxhbmd1YWdlIiwgZGVmYXVsdD0iIikKICAgIGFwLmFkZF9hcmd1bWVudCgiLS15dGRscCIsIGRlZmF1bHQ9Inl0LWRscCIpCiAgICBhcC5hZGRfYXJndW1lbnQoIi0tY29va2llIiwgZGVmYXVsdD0iIikKICAgIGFwLmFkZF9hcmd1bWVudCgiLS1tZWRpYS11cmwiLCBkZWZhdWx0PSIiLCBoZWxwPSLmkq3mlL7lmajmipPliLDnmoQgQ0ROIOebtOmTvu+8iOS8mOWFiOS6jiB5dC1kbHDvvIkiKQogICAgYXAuYWRkX2FyZ3VtZW50KCItLXJlZmVyZXIiLCBkZWZhdWx0PSIiKQogICAgYXAuYWRkX2FyZ3VtZW50KCItLXRpbWVvdXQiLCB0eXBlPWludCwgZGVmYXVsdD0xODAwKQogICAgYXJncyA9IGFwLnBhcnNlX2FyZ3MoKQoKICAgIHRtcCA9IHRlbXBmaWxlLm1rZHRlbXAocHJlZml4PSJ2bnMtYXNyLSIpCiAgICB0cnk6CiAgICAgICAgdG1wX3BhdGggPSBfX2ltcG9ydF9fKCJwYXRobGliIikuUGF0aCh0bXApCiAgICAgICAgaWYgYXJncy5tZWRpYV91cmwgYW5kIChESVJFQ1RfTUVESUFfUkUuc2VhcmNoKGFyZ3MubWVkaWFfdXJsKSBvciAiZG91eWludm9kIiBpbiBhcmdzLm1lZGlhX3VybAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb3IgImJ5dGVjZG4iIGluIGFyZ3MubWVkaWFfdXJsKToKICAgICAgICAgICAgdHJ5OgogICAgICAgICAgICAgICAgYXVkaW8gPSBkb3dubG9hZF9kaXJlY3QoYXJncy5tZWRpYV91cmwsIHRtcF9wYXRoLCBhcmdzLnJlZmVyZXIpCiAgICAgICAgICAgIGV4Y2VwdCBFeGNlcHRpb24gYXMgZXhjOgogICAgICAgICAgICAgICAgbG9nKGYiW2Fzcl0g55u06ZO+5LiL6L295aSx6LSl77yM5Zue6YCAIHl0LWRscO+8mntleGN9IikKICAgICAgICAgICAgICAgIGF1ZGlvID0gZG93bmxvYWRfYXVkaW8oYXJncy51cmwsIGFyZ3MueXRkbHAsIHRtcF9wYXRoLCBhcmdzLmNvb2tpZSkKICAgICAgICBlbHNlOgogICAgICAgICAgICBhdWRpbyA9IGRvd25sb2FkX2F1ZGlvKGFyZ3MudXJsLCBhcmdzLnl0ZGxwLCB0bXBfcGF0aCwgYXJncy5jb29raWUpCiAgICAgICAgbG9nKGYiW2Fzcl0g6Z+z6aKR5bCx57uqIHthdWRpby5zdGF0KCkuc3Rfc2l6ZSAvLyAxMDI0fSBLQiIpCiAgICAgICAgc2FtcGxlcyA9IGxvYWRfYXVkaW8oYXVkaW8pCiAgICAgICAgbG9nKGYiW2Fzcl0g6YeH5qC354K5IHtsZW4oc2FtcGxlcyl9IikKCiAgICAgICAgZnJvbSBmYXN0ZXJfd2hpc3BlciBpbXBvcnQgV2hpc3Blck1vZGVsCiAgICAgICAgbW9kZWwgPSBXaGlzcGVyTW9kZWwoYXJncy5tb2RlbCwgZGV2aWNlPSJjcHUiLCBjb21wdXRlX3R5cGU9ImludDgiKQogICAgICAgIGxhbmcgPSBhcmdzLmxhbmd1YWdlIG9yIE5vbmUKCiAgICAgICAgZGVmIGNvbGxlY3QodXNlX3ZhZCk6CiAgICAgICAgICAgIHNlZ3MsIGluZm8gPSBtb2RlbC50cmFuc2NyaWJlKAogICAgICAgICAgICAgICAgc2FtcGxlcywgbGFuZ3VhZ2U9bGFuZywgdmFkX2ZpbHRlcj11c2VfdmFkLCBiZWFtX3NpemU9NSwKICAgICAgICAgICAgICAgIGNvbmRpdGlvbl9vbl9wcmV2aW91c190ZXh0PUZhbHNlLAogICAgICAgICAgICApCiAgICAgICAgICAgIGdvdCA9IFtdCiAgICAgICAgICAgIGZvciBzZWcgaW4gc2VnczoKICAgICAgICAgICAgICAgIHRleHQgPSBzaW1wbGlmaWVkKHNlZy50ZXh0LnN0cmlwKCkpCiAgICAgICAgICAgICAgICBpZiB0ZXh0OgogICAgICAgICAgICAgICAgICAgIGdvdC5hcHBlbmQoW3JvdW5kKGZsb2F0KHNlZy5zdGFydCksIDIpLCB0ZXh0XSkKICAgICAgICAgICAgcmV0dXJuIGdvdCwgaW5mbwoKICAgICAgICBpdGVtcywgaW5mbyA9IGNvbGxlY3QoVHJ1ZSkKICAgICAgICB1c2VkX3ZhZCA9IFRydWUKICAgICAgICBpZiBub3QgaXRlbXM6CiAgICAgICAgICAgIGxvZygiW2Fzcl0gVkFEIOi/h+a7pOWQjuayoeacieivremfs++8jOWFs+aOiSBWQUQg5YaN6K+V5LiA5qyhIikKICAgICAgICAgICAgaXRlbXMsIGluZm8gPSBjb2xsZWN0KEZhbHNlKQogICAgICAgICAgICB1c2VkX3ZhZCA9IEZhbHNlCiAgICAgICAgaXRlbXMgPSBtZXJnZShkcm9wX25vaXNlKGl0ZW1zKSkKICAgICAgICBwYXlsb2FkID0gewogICAgICAgICAgICAic2VnbWVudHMiOiBpdGVtcywKICAgICAgICAgICAgImxhbmd1YWdlIjogZ2V0YXR0cihpbmZvLCAibGFuZ3VhZ2UiLCAiIiksCiAgICAgICAgICAgICJkdXJhdGlvbiI6IHJvdW5kKGZsb2F0KGdldGF0dHIoaW5mbywgImR1cmF0aW9uIiwgMCkgb3IgMCksIDIpLAogICAgICAgICAgICAiY291bnQiOiBsZW4oaXRlbXMpLAogICAgICAgICAgICAidmFkIjogdXNlZF92YWQsCiAgICAgICAgfQogICAgICAgIHByaW50KGpzb24uZHVtcHMocGF5bG9hZCwgZW5zdXJlX2FzY2lpPUZhbHNlKSkKICAgICAgICByZXR1cm4gMAogICAgZXhjZXB0IEV4Y2VwdGlvbiBhcyBleGM6CiAgICAgICAgcHJpbnQoanNvbi5kdW1wcyh7ImVycm9yIjogc3RyKGV4Yyl9LCBlbnN1cmVfYXNjaWk9RmFsc2UpKQogICAgICAgIGxvZyhmIltlcnJvcl0ge2V4Y30iKQogICAgICAgIHJldHVybiAxCiAgICBmaW5hbGx5OgogICAgICAgIHNodXRpbC5ybXRyZWUodG1wLCBpZ25vcmVfZXJyb3JzPVRydWUpCgoKaWYgX19uYW1lX18gPT0gIl9fbWFpbl9fIjoKICAgIHN5cy5leGl0KG1haW4oKSkK";
/* EMBEDDED_ASR_BRIDGE_END */

const VIEW_TYPE_PLAYER = "vns-player";

/** 抖音 webview 用独立持久分区：登录态 / Cookie 跨重启保留 */
const DOUYIN_PARTITION = "persist:vns-douyin";
/** 分享短链只有手机 UA 才会停在 iesdouyin 落地页，那里才有 canonical / itemId */
const VNS_UA_MOBILE = "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1";
const VIDEO_EXT = ["mp4", "webm", "mkv", "mov", "m4v", "ogv", "avi", "flv", "ts", "mp3", "m4a", "wav", "flac", "ogg"];
const BOOK_EXT = ["md", "txt", "epub"];

/* ============================ utils ============================ */

function pad2(n) { return String(n).padStart(2, "0"); }

/** 把模型返回的 Markdown 拆成「概要 / 要点」两段 */
function splitSummary(md) {
  const src = String(md || "");
  const grab = (name) => {
    const re = new RegExp(`##\\s*${name}\\s*\\n([\\s\\S]*?)(?=\\n##\\s|$)`);
    const m = src.match(re);
    return m ? m[1].trim() : "";
  };
  let overview = grab("概要");
  let points = grab("要点");
  // 模型没按格式来时，整体当作概要
  if (!overview && !points && src.trim()) overview = src.trim();
  return { overview, points };
}

/** B站 qn → 中文画质名 */
function biliQualityLabel(qn) {
  const map = {
    127: "8K 超高清", 126: "杜比视界", 125: "HDR 真彩", 120: "4K 超清",
    116: "1080P60 高帧率", 112: "1080P+ 高码率", 80: "1080P 高清",
    74: "720P60 高帧率", 64: "720P 准高清", 32: "480P 清晰", 16: "360P 流畅", 6: "240P 极速",
  };
  return map[qn] || `画质 ${qn}`;
}

function fmtTime(sec) {
  sec = Math.max(0, Math.floor(sec || 0));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return h > 0 ? `${h}:${pad2(m)}:${pad2(s)}` : `${m}:${pad2(s)}`;
}

function decodeEnt(str) {
  return String(str)
    .replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(parseInt(d, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

function htmlToText(html) {
  let s = String(html || "");
  s = s.replace(/<!--[\s\S]*?-->/g, "");
  s = s.replace(/<(script|style|noscript|svg|head)[\s\S]*?<\/\1>/gi, "");
  s = s.replace(/<br\s*\/?>/gi, "\n");
  s = s.replace(/<\/(p|div|li|h[1-6]|tr|section|article|blockquote)>/gi, "\n\n");
  s = s.replace(/<li[^>]*>/gi, "- ");
  s = s.replace(/<[^>]+>/g, "");
  s = decodeEnt(s);
  s = s.replace(/[ \t\u00a0]+/g, " ");
  s = s.replace(/\n{3,}/g, "\n\n");
  return s.trim();
}

function slug(name) {
  return String(name || "untitled")
    .replace(/[\\/:*?"<>|#^\[\]\r\n\t]/g, " ")
    .replace(/\s+/g, " ").trim().slice(0, 80) || "untitled";
}

function fmValue(v) {
  if (v === null || v === undefined) return '""';
  const s = String(v).replace(/"/g, "'").replace(/\r?\n/g, " ");
  return `"${s}"`;
}

function parseVtt(text) {
  const out = [];
  let t = 0;
  const seen = new Set();
  for (const raw of String(text || "").split(/\r?\n/)) {
    const line = raw.trim();
    if (line.includes("-->")) {
      const m = line.match(/(\d+):(\d+):(\d+)[.,](\d+)/);
      if (m) t = (+m[1]) * 3600 + (+m[2]) * 60 + (+m[3]) + (+m[4]) / 1000;
      continue;
    }
    if (!line || /^\d+$/.test(line) || /^(WEBVTT|NOTE|Kind:|Language:)/.test(line)) continue;
    const clean = decodeEnt(line.replace(/<[^>]+>/g, "")).trim();
    if (!clean || seen.has(clean)) continue;
    seen.add(clean);
    out.push([t, clean]);
  }
  return out;
}

function mergeLines(items, minChars = 24, maxGap = 8, maxChars = 140) {
  const merged = [];
  for (const [start, text] of items) {
    if (merged.length) {
      const [lastStart, lastText] = merged[merged.length - 1];
      const ended = /[。？！?!.；;]$/.test(lastText) && lastText.length >= minChars;
      if (!ended && lastText.length < maxChars && lastText.length < minChars * 4 &&
          start - lastStart <= maxGap && lastText.length + text.length <= maxChars) {
        merged[merged.length - 1] = [lastStart, `${lastText} ${text}`.trim()];
        continue;
      }
    }
    merged.push([start, text]);
  }
  return merged;
}

/**
 * 从「分享文案」里挖出链接：
 *   "7.43 复制打开抖音，看看【xxx的作品】… https://v.douyin.com/iRNBho6u/ 复制此链接…"
 *   "v.douyin.com/iRNBho6u/"（没写 http）
 * 同时去掉链接尾巴上粘住的中文标点。
 */
function extractUrl(raw) {
  let s = String(raw || "").trim();
  if (!s) return s;
  const tail = /[\s，。！？、；：""''（）【】…《》<>]+$/u;
  if (/^(https?:\/\/|obsidian:\/\/|file:\/\/)/i.test(s)) {
    const lead = s.match(/^(https?:\/\/|obsidian:\/\/|file:\/\/)[^\s，。！？、；：""''（）【】…《》<>]+/i);
    return lead ? lead[0] : s;
  }
  const full = s.match(/https?:\/\/[^\s，。！？、；：""''（）【】…《》<>]+/i);
  if (full) return full[0].replace(tail, "");
  const bare = s.match(/(?:v\.douyin\.com|v\.iesdouyin\.com|www\.douyin\.com|douyin\.com|b23\.tv|bili2233\.cn|bilibili\.com|youtu\.be|youtube\.com)\/[^\s，。！？、；：""''（）【】…《》<>]+/i);
  if (bare) return `https://${bare[0].replace(tail, "")}`;
  return s.replace(tail, "");
}

function detectLink(raw) {
  const url = extractUrl(raw);
  let m;
  if ((m = url.match(/bilibili\.com\/video\/(BV[0-9A-Za-z]{6,})/))) {
    const p = url.match(/[?&]p=(\d+)/);
    return { kind: "bilibili", id: m[1], page: p ? +p[1] : 1, url };
  }
  if ((m = url.match(/youtube\.com\/(?:watch\?.*v=|shorts\/)([0-9A-Za-z_-]{11})/)) ||
      (m = url.match(/youtu\.be\/([0-9A-Za-z_-]{11})/))) {
    return { kind: "youtube", id: m[1], url };
  }
  if ((m = url.match(/douyin\.com\/(?:video|note|slides)\/(\d+)/)) ||
      (m = url.match(/iesdouyin\.com\/share\/(?:video|note)\/(\d+)/))) return { kind: "douyin", id: m[1], url };
  if (/v\.douyin\.com|v\.iesdouyin\.com|b23\.tv|bili2233\.cn|bili22\.cn/.test(url)) return { kind: "short", id: "", url };
  if (/mp\.weixin\.qq\.com/.test(url)) return { kind: "weixin", id: "", url };
  if (/(pan\.baidu\.com|aliyundrive\.com|alipan\.com|pan\.quark\.cn|123pan\.com|pan\.xunlei\.com|cloud\.189\.cn)/.test(url)) {
    return { kind: "netdisk", id: "", url };
  }
  if (/^[A-Za-z]:[\\/]/.test(url)) return { kind: "file", id: "", url };
  if (/\.(mp4|webm|mkv|mov|m4v|mp3|m4a|flac|wav|ogg)(\?|$)/i.test(url)) return { kind: "direct", id: "", url };
  if (/^https?:\/\//i.test(url)) return { kind: "web", id: "", url };
  return { kind: "file", id: "", url };
}

function embedFor(link, startAt) {
  const t = Math.max(0, Math.floor(startAt || 0));
  const auto = t > 0 ? 1 : 0;
  if (link.kind === "bilibili") {
    return `https://player.bilibili.com/player.html?bvid=${link.id}&page=${link.page || 1}`
      + `&high_quality=1&danmaku=0&autoplay=${auto}`;
  }
  if (link.kind === "youtube") {
    return `https://www.youtube.com/embed/${link.id}?enablejsapi=1&rel=0`
      + `${t ? `&start=${t}&autoplay=1` : ""}`;
  }
  if (link.kind === "douyin") {
    return `https://open.douyin.com/player/video?vid=${link.id}&autoplay=${auto}`;
  }
  return null;
}

/** B站 内嵌播放器地址（隐藏弹幕、隐藏相关推荐、可按需隐藏自带控制条） */
function biliEmbedUrl(link, startAt, hideControls) {
  const t = Math.max(0, Math.floor(startAt || 0));
  const parts = [
    `bvid=${link.id}`,
    `page=${link.page || 1}`,
    "high_quality=1",
    "danmaku=0",
    "autoplay=" + (t > 0 ? 1 : 0),
    "as_wide=1",
    "hideDanmaku=true",
  ];
  if (t > 0) parts.push(`t=${t}`);
  if (hideControls) parts.push("noShare=true");
  return `https://player.bilibili.com/player.html?${parts.join("&")}`;
}

/** 生成能在 Obsidian 内部跳转播放的时间戳链接（走插件注册的 obsidian://vns 协议） */
function tsLink(link, sec, mode) {
  const s = Math.max(0, Math.floor(sec || 0));
  if (mode === "browser") return seekUrl(link, s);
  const u = encodeURIComponent(link.url || "");
  const p = link.kind === "bilibili" && link.page > 1 ? `&p=${link.page}` : "";
  return `obsidian://vns?u=${u}&t=${s}${p}`;
}

function seekUrl(link, sec) {
  const s = Math.max(0, Math.floor(sec || 0));
  if (link.kind === "bilibili") {
    const base = (link.url || "").split("?")[0];
    return `${base}?t=${s}${link.page > 1 ? `&p=${link.page}` : ""}`;
  }
  if (link.kind === "youtube") return `https://youtu.be/${link.id}?t=${s}`;
  return link.url;
}

async function ensureFolder(app, path) {
  const p = normalizePath(path);
  if (!p) return;
  if (app.vault.getAbstractFileByPath(p)) return;
  try { await app.vault.createFolder(p); } catch (e) { /* exists */ }
}

function uniquePath(app, folder, base) {
  const dir = normalizePath(folder);
  let path = normalizePath(`${dir}/${base}.md`);
  let n = 2;
  while (app.vault.getAbstractFileByPath(path)) {
    path = normalizePath(`${dir}/${base} (${n}).md`);
    n += 1;
  }
  return path;
}

const DEFAULT_SETTINGS = {
  inboxFolder: "Clippings",
  playerSplit: "split",
  timestampMode: "inapp",
  ytDlpPath: "yt-dlp",
  asrEnabled: true,
  biliNative: false,
  autoOpenPlayerOnNote: true,
  biliNativeQn: 80,
  pythonPath: "python",
  asrModel: "small",
  asrLanguage: "",
  lastAsrError: "",
  subsLangs: "zh-Hans,zh-CN,zh,en",
  llmBaseUrl: "https://api.deepseek.com/v1",
  llmApiKey: "",
  llmModel: "deepseek-chat",
  visionModel: "",
  magpieEnabled: false,
  magpieBaseUrl: "http://127.0.0.1:3425/v1",
  magpieModel: "auto/deepseek-v4.1-flash",
  autoSummarize: true,
  autoTranslate: false,
  translateTo: "zh",
  autoCanvas: false,
  canvasFolder: "Canvas",
  ocrFolder: "Clippings/OCR",
  bookFolder: "Books",
  clipperCompat: true,
  clipperTags: "clippings",
  habitNote: "_meta/使用习惯.md",
  habitEnabled: true,
  habits: { counters: {}, events: [] },
  biliCookies: {},
  biliUser: null,
  douyinWebview: true,
  webviewPages: true,
  douyinImmersive: true,
  douyinAspectFit: true,
  douyinCookieHeader: "",
  douyinCookieAt: 0,
  favFolder: "抖音收藏",
  favAttachFolder: "抖音收藏/附件",
  favMode: "light",
  favLimit: 20,
  favPageDelayMin: 6,
  favPageDelayMax: 12,
  favAutoSync: false,
  favEveryMin: 0,
  favLastSync: 0,
};

/* ============================ 播放器视图 ============================ */

class VideoPlayerView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.link = null;
    this.notePath = null;
    this.videoEl = null;
    this.iframeEl = null;
    this.webviewEl = null;
    this.webviewWarnEl = null;
    this.lastKnownTime = 0;
    this.timer = null;
    this.onMessage = this.onMessage.bind(this);
  }

  getViewType() { return VIEW_TYPE_PLAYER; }
  getDisplayText() { return this.link ? `▶ ${this.link.title || this.link.url}` : "Video Note Studio"; }
  getIcon() { return "play-circle"; }

  async onOpen() {
    this.registerDomEvent(window, "message", this.onMessage);
    this.render();
    const pending = this.plugin.pendingUrl;
    if (pending) { this.plugin.pendingUrl = null; await this.load(pending); }
  }

  async onClose() {
    this.destroyPlayerChrome();
    this.hideQualityMenu();
    if (this.webviewEl) { try { this.webviewEl.remove(); } catch (e) { /* ignore */ } this.webviewEl = null; }
  }

  onMessage(ev) {
    try {
      const data = typeof ev.data === "string" ? JSON.parse(ev.data) : ev.data;
      if (data && data.info && typeof data.info.currentTime === "number") {
        this.lastKnownTime = data.info.currentTime;
        this.updateClock();
      }
    } catch (e) { /* 非 JSON 消息忽略 */ }
  }

  render() {
    const root = this.contentEl;
    root.empty();
    root.addClass("vns-root");

    const toolbar = root.createDiv({ cls: "vns-toolbar" });
    const btn = (parent, label, fn, cls) => {
      const b = parent.createEl("button", { cls: `vns-btn ${cls || ""}`, text: label });
      b.addEventListener("click", fn);
      return b;
    };

    // 来源：只放与输入有关的控件
    const inputRow = toolbar.createDiv({ cls: "vns-input-row" });
    this.urlInput = inputRow.createEl("input", {
      cls: "vns-url", type: "text",
      placeholder: "粘贴视频 / 网页链接，或选择本地文件…",
    });
    this.urlInput.addEventListener("keydown", (e) => { if (e.key === "Enter") this.load(this.urlInput.value); });
    const sourceBtns = inputRow.createDiv({ cls: "vns-btn-group" });
    btn(sourceBtns, "播放", () => this.load(this.urlInput.value), "is-accent");
    btn(sourceBtns, "本地", () => this.plugin.pickLocalVideo((f) => this.loadFile(f)));
    btn(sourceBtns, "清除", () => this.clearAll(), "is-ghost");

    // 播放器（紧贴输入区下方，尽量上移）——视频标题等信息改为贴在播放器下方，不再单独占一行
    this.stageWrap = root.createDiv({ cls: "vns-stage-wrap" });
    this.stage = this.stageWrap.createDiv({ cls: "vns-stage" });
    this.stage.createDiv({ cls: "vns-empty", text: "粘贴链接或选择本地视频开始" });

    // B站登录按钮仅在未登录时提示；已登录不显示
    this.biliLoginBtn = root.createEl("button", {
      cls: "vns-btn is-ghost vns-login-inline",
      text: "B站登录",
    });
    this.biliLoginBtn.title = "扫码登录后，播放器使用你的账号清晰度（具体画质取决于视频与账号权限）";
    this.biliLoginBtn.addEventListener("click", () => this.openBiliLogin());
    this._syncBiliLoginBtn();

    // ─── 播放器下方：操作按钮行 ───
    this.actionBar = root.createDiv({ cls: "vns-actionbar" });
    const actionBtn = (label, fn, cls) => {
      const b = this.actionBar.createEl("button", { cls: `vns-btn ${cls || ""}`, text: label });
      b.addEventListener("click", fn);
      return b;
    };
    actionBtn("⏱ 打时间戳", () => this.captureTimestamp(), "is-accent");
    const actionSpacer = this.actionBar.createDiv({ cls: "vns-actionbar-spacer" });
    actionBtn("生成笔记", () => this.plugin.importLink(this.link ? this.link.url : this.urlInput.value, { player: this }));
    actionBtn("生成 Canvas", () => this.generateCanvas());

    // ─── 播放器下方空白区：显示当前视频笔记的「概要 / 要点」 ───
    this.summaryPanel = root.createDiv({ cls: "vns-summary" });
    this.summaryPanel.createDiv({ cls: "vns-summary-empty", text: "概要会显示在这里（生成笔记后自动载入）" });

    // 底部状态栏已移除（用户不需要时间显示）
  }

  /** 读取笔记并解析出「概要 / 要点」两段 */
  async loadSummaryPanel() {
    if (!this.summaryPanel) return;
    this.summaryPanel.empty();
    if (!this.link) {
      this.summaryPanel.createDiv({ cls: "vns-summary-empty", text: "播放视频后，这里显示概要和时间戳" });
      return;
    }
    let data = await this.plugin.loadPanelData(this.link);
    let noteFile = null;
    const path = this.notePath || this.plugin.noteIndex.get(this.link.url);
    if (path) {
      const f = this.app.vault.getAbstractFileByPath(normalizePath(path));
      if (f instanceof TFile) noteFile = f;
    }
    // 兼容旧笔记：面板数据不存在时，从笔记里解析
    if (!data && noteFile) {
      const md = await this.app.vault.read(noteFile);
      const pick = (name) => {
        const re = new RegExp(`##\\s*${name}\\s*\\n([\\s\\S]*?)(?=\\n##\\s|$)`);
        const m = md.match(re);
        return m ? m[1].trim() : "";
      };
      const overview = pick("概要");
      const tsSection = pick("时间戳");
      const transcript = [];
      for (const line of tsSection.split(/\r?\n/)) {
        const m = line.match(/^-\s*\[(\d+):(\d{2})\][^)]*\)?\s*(.*)$/);
        if (!m) continue;
        transcript.push([Number(m[1]) * 60 + Number(m[2]), m[3].replace(/\]\([^)]*\)/, "").trim()]);
      }
      if (overview || transcript.length) data = { overview, transcript };
    }
    if (!data || (!data.overview && !(data.transcript || []).length)) {
      this.summaryPanel.createDiv({
        cls: "vns-summary-empty",
        text: noteFile ? "这篇还没有概要和时间戳（可能需要配模型或先做转录）" : "还没有这篇视频的笔记，点「生成笔记」后这里会出现概要和时间戳",
      });
      return;
    }

    if (data.overview) {
      const head = this.summaryPanel.createDiv({ cls: "vns-summary-head" });
      head.createSpan({ cls: "vns-summary-title", text: "概要" });
      if (noteFile) {
        const linkEl = head.createEl("a", { cls: "vns-summary-open", text: "打开笔记" });
        linkEl.addEventListener("click", () => this.app.workspace.getLeaf("tab").openFile(noteFile));
      }
      this.summaryPanel.createDiv({ cls: "vns-summary-body" }).createEl("p", { text: data.overview });
    }

    const transcript = data.transcript || [];
    if (transcript.length) {
      this.summaryPanel.createDiv({ cls: "vns-summary-title vns-summary-title-gap", text: "时间戳" });
      const list = this.summaryPanel.createDiv({ cls: "vns-ts-list" });
      for (const [t, text] of transcript) {
        const row = list.createDiv({ cls: "vns-ts-row" });
        const stamp = row.createEl("a", { cls: "vns-ts-time", text: fmtTime(t) });
        stamp.addEventListener("click", (ev) => {
          ev.preventDefault();
          this.seek(t);
          if (this.videoEl) this.videoEl.play().catch(() => {});
        });
        row.createSpan({ cls: "vns-ts-text", text: String(text) });
      }
    }
  }

  /** 同步 B站登录按钮显隐：已登录时完全隐藏，不打扰 */
  _syncBiliLoginBtn() {
    if (!this.biliLoginBtn) return;
    const logged = !!(this.plugin.settings.biliCookies && Object.keys(this.plugin.settings.biliCookies).length);
    this.biliLoginBtn.style.display = logged ? "none" : "";
  }

  /** 视频信息行已移除（用户要求直接删掉，不做展示），保留空方法兼容调用点 */
  updateMeta(link) {
    this._syncBiliLoginBtn();
  }

  openBiliLogin() {
    new BiliLoginModal(this.app, this.plugin, async (loggedIn) => {
      this._syncBiliLoginBtn();
      if (loggedIn && this.link && this.link.kind === "bilibili") this.attach(this.link, this.currentTime());
    }).open();
  }

  setStatus(text) {
    // 状态栏已移除，仅写日志便于排查
    console.debug("[vns]", text);
  }

  clearAll() {
    this.destroyPlayerChrome();
    this.hideQualityMenu();
    // 停掉正在播放的视频 / iframe
    if (this.videoEl) {
      try { this.videoEl.pause(); this.videoEl.removeAttribute("src"); this.videoEl.load(); } catch (e) { /* ignore */ }
      this.videoEl = null;
    }
    if (this.audioEl) {
      try { this.audioEl.pause(); this.audioEl.removeAttribute("src"); this.audioEl.load(); } catch (e) { /* ignore */ }
      this.audioEl = null;
    }
    if (this.iframeEl) { this.iframeEl.src = "about:blank"; this.iframeEl = null; }
    if (this.webviewEl) { try { this.webviewEl.remove(); } catch (e) { /* ignore */ } this.webviewEl = null; }
    if (this.stage) this.stage.removeClass("is-webview");
    this.webviewWarnEl = null;

    // 重置状态
    this.link = null;
    this.notePath = null;
    this.lastKnownTime = 0;

    // 清空 UI
    if (this.urlInput) this.urlInput.value = "";
    if (this.stage) { this.stage.empty(); this.stage.createDiv({ cls: "vns-empty", text: "粘贴链接或选择本地视频开始" }); }
    this.updateMeta(null);
    this.updateClock();
    this.setStatus("已清除");
  }

  async load(input, startAt) {
    const raw = String(input || "").trim();
    if (!raw) return;
    this.plugin.recordHabit("player-load");
    let link = detectLink(raw);
    link.url = link.kind === "file" ? raw : extractUrl(raw);
    if (link.kind === "file") {
      const f = this.app.vault.getAbstractFileByPath(normalizePath(raw));
      if (f instanceof TFile) return this.loadFile(f, startAt);
      new Notice("找不到这个本地文件，试着用「本地文件」按钮选择");
      return;
    }
    if (link.kind === "short") {
      this.setStatus("解析分享短链…");
      try {
        // 注意传抠出来的短链（link.url），不能传 raw：raw 可能是整段分享文案
        link = await this.plugin.resolveShortLink(link.url);
      } catch (e) {
        new Notice(e.message, 8000);
        this.stage.empty();
        this.stage.createDiv({ cls: "vns-empty", text: e.message });
        return;
      }
    }
    await this.fillMeta(link);
    this.attach(link, startAt);
  }

  loadFile(file, startAt) {
    const link = { kind: "file", id: file.path, url: file.path, title: file.basename, file };
    this.attach(link, startAt);
  }

  async fillMeta(link) {
    try {
      const meta = await this.plugin.fetchMeta(link);
      Object.assign(link, meta);
    } catch (e) { /* 元数据拿不到不影响播放 */ }
  }

  attach(link, startAt) {
    this.link = link;
    this.notePath = null;
    this.lastKnownTime = 0;
    if (this.timer) clearInterval(this.timer);
    this.destroyPlayerChrome();
    this.resetStageAspect();
    this.stage.empty();
    this.stage.removeClass("is-webview");
    this.webviewEl = null;
    this.webviewWarnEl = null;
    this.videoEl = null;
    this.audioEl = null;
    this.iframeEl = null;
    this.setStatus("加载中…");
    this.updateMeta(link);
    this.hideQualityMenu();

    if (link.kind === "file") {
      const f = link.file || this.app.vault.getAbstractFileByPath(normalizePath(link.url));
      if (!(f instanceof TFile)) {
        this.stage.createDiv({ cls: "vns-empty", text: "文件不可读" });
        this.setStatus("文件不可读");
        return;
      }
      this.urlInput.value = f.path;
      this.mountNativePlayer(this.app.vault.getResourcePath(f), { startAt, title: link.title });
      return;
    }

    if (link.kind === "douyin") {
      this.urlInput.value = link.url;
      if (this.plugin.settings.douyinWebview !== false) {
        this.mountWebview(link, startAt);
        this.loadSummaryPanel().catch(() => {});
        return;
      }
      this.stage.createDiv({
        cls: "vns-empty",
        text: "抖音已关闭内嵌播放：可在设置里打开「抖音使用内嵌浏览器播放」；生成笔记不受影响。",
      });
      this.setStatus("抖音内嵌播放已关闭");
      return;
    }

    if (["web", "weixin", "netdisk"].includes(link.kind) && this.plugin.settings.webviewPages !== false) {
      this.urlInput.value = link.url;
      this.mountWebview(link, startAt);
      this.loadSummaryPanel().catch(() => {});
      return;
    }

    if (link.kind === "bilibili" && this.plugin.settings.biliNative) {
      this.urlInput.value = link.url;
      this.loadBilibili(link, startAt);
      return;
    }

    if (link.kind === "direct") {
      this.urlInput.value = link.url;
      this.mountNativePlayer(link.url, { startAt, title: link.title });
      return;
    }

    const src = embedFor(link, startAt);
    this.urlInput.value = link.url;
    if (!src) {
      this.stage.createDiv({ cls: "vns-empty", text: `${link.kind} 类型的链接无法内嵌播放，可「生成笔记」后跳浏览器观看` });
      this.setStatus("不支持内嵌播放");
      return;
    }
    this.mountIframe(src);
    this.setStatus("就绪");
    this.loadSummaryPanel().catch(() => {});
  }

  /** B站：直链原生播放，失败自动回退 iframe */
  async loadBilibili(link, startAt) {
    try {
      const stream = await this.plugin.resolveBiliStream(link);
      this.biliStream = stream;
      this.setStatus("已解析直链，正在加载…");
      if (stream.mode === "dash") {
        const pick = this.plugin.pickDashStream(stream, stream.current);
        if (!pick.videoUrl) throw new Error("DASH 没有可用视频流");
        this.mountNativePlayer(pick.videoUrl, {
          startAt,
          title: link.title,
          audioSrc: pick.audioUrl,
          qualities: stream.qualities,
          currentQn: pick.qn,
        });
      } else {
        const first = stream.durl[0];
        if (!first || !first.url) throw new Error("没有可用播放地址");
        this.mountNativePlayer(first.url, {
          startAt,
          title: link.title,
          qualities: stream.qualities,
          currentQn: stream.current,
        });
      }
      this.setStatus("就绪");
    } catch (e) {
      console.debug("[vns] B站 直链失败，回退 iframe", e.message);
      this.setStatus("直链失败，已回退内嵌播放器");
      if (!this.plugin._biliRefererOk) {
        new Notice(`B站 直链失败（Referer 注入未生效，这是 Electron 权限问题）：${e.message}`, 10000);
      } else {
        new Notice(`B站 直链解析失败，已回退内嵌播放器：${e.message}`, 8000);
      }
      this.biliStream = null;
      this.mountIframe(embedFor(link, startAt));
    }
  }

  /** 切换 B站 画质 */
  async switchBiliQuality(qn) {
    if (!this.link || this.link.kind !== "bilibili") return;
    this.hideQualityMenu();
    const current = this.videoEl ? this.videoEl.currentTime : this.lastKnownTime;
    const wasPlaying = this.videoEl ? !this.videoEl.paused : false;
    try {
      const stream = await this.plugin.resolveBiliStream(this.link, qn);
      this.biliStream = stream;
      if (stream.mode === "dash") {
        const pick = this.plugin.pickDashStream(stream, qn);
        if (!pick.videoUrl) throw new Error(`${biliQualityLabel(qn)} 没有可用流`);
        this.mountNativePlayer(pick.videoUrl, {
          startAt: current,
          title: this.link.title,
          audioSrc: pick.audioUrl,
          qualities: stream.qualities,
          currentQn: pick.qn,
          autoplay: wasPlaying,
        });
      } else {
        this.mountNativePlayer(stream.durl[0].url, {
          startAt: current,
          title: this.link.title,
          qualities: stream.qualities,
          currentQn: stream.current,
          autoplay: wasPlaying,
        });
      }
      this.setStatus(`已切换到 ${biliQualityLabel(qn)}`);
    } catch (e) {
      new Notice(`切换画质失败：${e.message}`, 6000);
    }
  }

  /** 内嵌 webview 播放：抖音、以及 iframe 常被 X-Frame-Options / 反嵌脚本挡住的普通网页 */
  mountWebview(link, startAt) {
    const url = link.kind === "douyin" && link.id
      ? `https://www.douyin.com/video/${link.id}`
      : link.url;
    link.url = url;
    this.stage.addClass("is-webview");
    const hint = link.kind === "douyin" ? "抖音官方页面加载中…" : "网页加载中（内嵌浏览器，可播放被 iframe 拦截的视频）…";
    this.webviewWarnEl = this.stage.createDiv({ cls: "vns-webview-hint", text: hint });
    this.webviewEl = this.plugin.createDouyinWebview(this.stage, url, link.kind);
    this.webviewEl.addEventListener("did-fail-load", (ev) => {
      if (ev && (ev.errorCode === -3 || ev.errorCode === 0)) return;
      if (this.webviewWarnEl) this.webviewWarnEl.setText(`页面加载失败：${ev && ev.errorDescription}`);
    });
    this.webviewEl.addEventListener("dom-ready", () => {
      this.applyWebviewZoom(link.kind === "douyin" ? (this.plugin.settings.douyinZoom || 0.8) : 1);
      if (link.kind === "douyin" && this.plugin.settings.douyinImmersive !== false) {
        this.setImmersive(true, { remember: false });
      }
      this.onWebviewReady(link, startAt);
    });
    this.webviewEl.addEventListener("did-navigate-in-page", () => {
      if (this.immersive) setTimeout(() => this.setImmersive(true, { remember: false }), 800);
    });
    this.mountWebviewZoomBar(link);
    this.timer = setInterval(() => this.tick(), 1000);
    this.updateClock();
  }

  /** 抖音页面很"高"，默认缩到 0.8 才看得到整块视频；这里给一组缩放按钮 */
  mountWebviewZoomBar(link) {
    const bar = this.stage.createDiv({ cls: "vns-webview-zoom" });
    const mk = (label, title, fn) => {
      const b = bar.createEl("button", { cls: "vns-zoom-btn", text: label });
      if (title) b.title = title;
      b.addEventListener("click", (e) => { e.stopPropagation(); fn(); });
      return b;
    };
    mk("−", "缩小页面", () => this.applyWebviewZoom((this.webviewZoom || 1) * 0.9));
    mk("+", "放大页面", () => this.applyWebviewZoom((this.webviewZoom || 1) * 1.1));
    mk("适配", "缩到能看见整页（整块视频）", () => this.applyWebviewZoom(link.kind === "douyin" ? 0.8 : 1));
    this.cropBtn = mk("比例", "沉浸时播放区按视频真实比例适配（画面完整、不带黑边）；再点恢复固定播放区", () => this.toggleWebviewCrop());
    this.cropBtn.toggleClass("is-active", this.plugin.settings.douyinAspectFit !== false);
    this.immersiveBtn = mk("沉浸", "只留视频：隐藏页面头尾/评论区，黑边按「裁切」处理", () => this.setImmersive(!this.immersive));
    mk("全屏", "把播放器区域全屏", () => this.toggleFullscreen(this.stageWrap));
    this.syncImmersiveBtn();
  }

  syncImmersiveBtn() {
    if (!this.immersiveBtn) return;
    this.immersiveBtn.setText(this.immersive ? "退出沉浸" : "沉浸");
    this.immersiveBtn.toggleClass("is-active", !!this.immersive);
  }

  /** 沉浸去黑边：开=播放区按视频比例适配（完整显示不裁内容），关=固定播放区（可能带黑边） */
  toggleWebviewCrop() {
    this.plugin.settings.douyinAspectFit = this.plugin.settings.douyinAspectFit === false;
    this.plugin.saveSettings().catch(() => {});
    if (this.cropBtn) this.cropBtn.toggleClass("is-active", this.plugin.settings.douyinAspectFit !== false);
    if (!this.plugin.settings.douyinAspectFit) this.resetStageAspect();
    new Notice(this.plugin.settings.douyinAspectFit ? "沉浸画面：按视频比例适配（不裁内容）" : "沉浸画面：固定播放区（可能带黑边）", 2500);
  }

  /**
   * 沉浸模式：只留 <video>。三层手段，黑幕只是兜底：
   * 1. 沿 video→body 祖先链清掉 transform/filter 等会让 position:fixed 失效的属性
   *    （否则 video 浮不出容器，页面头尾/评论区照旧露着），并给链上每一级抬 z-index；
   * 2. 把链上每一级的兄弟节点（页面头尾 / 评论区 / 播放器控制条）visibility:hidden，
   *    相当于把页面剥得只剩播放链；
   * 3. 全屏黑幕盖住一切漏网内容。
   * 画面始终 contain 完整显示（一根像素不裁）；黑边由播放区按视频真实比例适配消掉（fitStageToAspect）。
   * 抖音 SPA 会重渲染（切下个视频、评论区懒加载），注入常驻定时器每秒补妆；
   * 退出沉浸 = reload 整页，页面内不会留任何东西。
   */
  async setImmersive(on, opts = {}) {
    const remember = opts.remember !== false;
    this.immersive = !!on;
    if (remember) {
      this.plugin.settings.douyinImmersive = !!on;
      this.plugin.saveSettings().catch(() => {});
    }
    this.syncImmersiveBtn();
    const wv = this.webviewEl;
    if (!wv) return;
    if (!on) {
      this.resetStageAspect();
      try { wv.reload(); } catch (e) { /* ignore */ }
      return;
    }
    const script = `(() => {
      const CURTAIN_Z = 2147483000, CHAIN_Z = 2147483200, VIDEO_Z = 2147483600;
      const hidden = [];
      const CLEAR = { transform: 'none', filter: 'none', 'backdrop-filter': 'none', perspective: 'none', 'will-change': 'auto', contain: 'none', isolation: 'auto', zoom: 'normal' };
      // 挑「最能播」的视频：有真实尺寸里面积最大的（querySelector 可能撞上预加载的空 video）
      const best = () => {
        const vids = Array.from(document.querySelectorAll('video'));
        const good = vids.filter((x) => x.videoWidth > 0 && x.videoHeight > 0)
          .sort((a, b) => (b.videoWidth * b.videoHeight) - (a.videoWidth * a.videoHeight));
        return good[0] || vids[0] || null;
      };
      const apply = () => {
        const v = best();
        if (!v) return 'no-video';
        // 3) 黑幕：盖住漏网内容（不删 DOM，避免打断 React / 播放逻辑）
        let curtain = document.getElementById('__vns_curtain');
        if (!curtain) {
          curtain = document.createElement('div');
          curtain.id = '__vns_curtain';
          document.body.appendChild(curtain);
        }
        curtain.style.cssText = 'position:fixed;inset:0;background:#000;z-index:' + CURTAIN_Z + ';';
        // 先把上一轮藏掉的元素放出来：万一被 React 回收进播放链，不能再是隐藏态
        while (hidden.length) { const el = hidden.pop(); try { el.style.visibility = ''; } catch (e) {} }
        // 1) + 2)：沿祖先链清 fixed 陷阱、抬层级、藏兄弟
        let el = v;
        while (el && el !== document.body) {
          const parent = el.parentElement;
          if (!parent) break;
          for (const sib of parent.children) {
            if (sib === el || sib.contains(el) || sib.id === '__vns_curtain') continue;
            const tag = sib.tagName;
            if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'LINK' || tag === 'NOSCRIPT') continue;
            if (sib.style.visibility !== 'hidden') { sib.style.visibility = 'hidden'; hidden.push(sib); }
          }
          if (el !== v) {
            el.style.setProperty('z-index', String(CHAIN_Z), 'important');
            if (getComputedStyle(el).position === 'static') el.style.setProperty('position', 'relative', 'important');
          }
          for (const p in CLEAR) el.style.setProperty(p, CLEAR[p], 'important');
          el = parent;
        }
        // video 本体：铺满视口，contain 完整显示不裁内容（黑边由播放区比例适配消掉）
        v.style.setProperty('position', 'fixed', 'important');
        v.style.setProperty('inset', '0', 'important');
        v.style.setProperty('width', '100vw', 'important');
        v.style.setProperty('height', '100vh', 'important');
        v.style.setProperty('object-fit', 'contain', 'important');
        v.style.setProperty('z-index', String(VIDEO_Z), 'important');
        v.style.setProperty('background', '#000', 'important');
        // 控制条也被藏了，点画面切播放
        if (!v.__vnsClick) {
          v.__vnsClick = true;
          v.addEventListener('click', () => { if (v.paused) v.play().catch(() => {}); else v.pause(); });
        }
        document.documentElement.style.setProperty('overflow', 'hidden', 'important');
        document.body.style.setProperty('overflow', 'hidden', 'important');
        return 'ok';
      };
      const first = apply();
      if (window.__vnsImmersiveTimer) clearInterval(window.__vnsImmersiveTimer);
      window.__vnsImmersiveTimer = setInterval(apply, 1000);
      const v0 = best();
      return JSON.stringify({ ok: first === 'ok', aspect: v0 && v0.videoHeight ? v0.videoWidth / v0.videoHeight : 0 });
    })()`;
    try {
      const r = await wv.executeJavaScript(script, true);
      let j = null;
      try { j = typeof r === "string" && r.startsWith("{") ? JSON.parse(r) : null; } catch (e) { /* 兼容旧返回 */ }
      if (!j || !j.ok) {
        if (this.webviewWarnEl) this.webviewWarnEl.setText("沉浸模式：页面上还没出现 <video>，稍后会自动重试");
      } else {
        if (j.aspect > 0.05 && this.plugin.settings.douyinAspectFit !== false) this.fitStageToAspect(j.aspect);
        if (this.webviewWarnEl) this.webviewWarnEl.setText("沉浸模式：只显示视频（完整画面不裁内容，点画面暂停/续播，再点「退出沉浸」恢复整页）");
      }
    } catch (e) { console.debug("[vns] 沉浸模式注入失败", e.message); }
  }

  applyWebviewZoom(z) {
    this.webviewZoom = Math.min(2, Math.max(0.35, Number(z) || 1));
    try {
      if (this.webviewEl && typeof this.webviewEl.setZoomFactor === "function") {
        this.webviewEl.setZoomFactor(this.webviewZoom);
      }
    } catch (e) { /* webview 可能还没挂载完 */ }
    this.plugin.settings.douyinZoom = this.webviewZoom;
    this.plugin.saveSettings().catch(() => {});
  }

  /** 沉浸去黑边：播放区缩放成视频真实比例（画面 contain 完整显示，一根像素不裁） */
  fitStageToAspect(aspect) {
    if (!this.stage || !this.stageWrap || !isFinite(aspect) || aspect <= 0.05) return;
    if (this.stageAspect && Math.abs(this.stageAspect - aspect) < 0.01) return;
    this.stageAspect = aspect;
    const availH = Math.min(Math.max(window.innerHeight * 0.72, 420), 980); // 与 .is-webview 的 clamp 同参
    const availW = this.stageWrap.clientWidth || 800;
    let h = availH, w = h * aspect;
    if (w > availW) { w = availW; h = w / aspect; }
    this.stage.style.width = `${Math.round(w)}px`;
    this.stage.style.height = `${Math.round(h)}px`;
  }

  resetStageAspect() {
    this.stageAspect = 0;
    if (!this.stage) return;
    this.stage.style.width = "";
    this.stage.style.height = "";
  }

  async onWebviewReady(link, startAt) {
    const wv = this.webviewEl;
    if (!wv) return;
    this.setStatus("内嵌页面已就绪，正在找播放器…");
    try {
      await wv.executeJavaScript(
        "(() => { const v = document.querySelector('video'); if (v) { v.muted = false; v.play().catch(() => {}); } return 1; })()", true);
    } catch (e) { /* 页面可能还没渲染完，轮询里会再试 */ }
    if (startAt > 2) this.webviewSeek(startAt);

    const started = Date.now();
    const poll = async () => {
      if (!this.webviewEl || this.webviewEl !== wv || !this.link) return;
      const st = await this.plugin.readDouyinState(wv);
      if (this.immersive && this.plugin.settings.douyinAspectFit !== false && st.vw > 0 && st.vh > 0) {
        this.fitStageToAspect(st.vw / st.vh);
      }
      const media = this.plugin.pickDouyinMedia(st);
      if (media) {
        this.link.mediaUrl = media;
        if (st.dur) this.link.duration = st.dur;
        if (this.webviewWarnEl) {
          this.webviewWarnEl.setText(`已连通播放器${st.dur ? `（${fmtTime(st.dur)}）` : ""}：可直接打时间戳 / 生成笔记`);
        }
        this.setStatus("就绪");
        if (link.kind === "douyin") this.plugin.harvestDouyinCookies(wv).catch(() => {});
        return;
      }
      if (Date.now() - started < 25000) {
        if (this.webviewWarnEl && /加载中/.test(this.webviewWarnEl.textContent || "")) {
          this.webviewWarnEl.setText("页面已加载，等待播放器就绪…（点一下画面里的播放键会更快）");
        }
        setTimeout(poll, 900);
      } else {
        if (link.kind === "douyin") this.plugin.harvestDouyinCookies(wv).catch(() => {});
        if (this.webviewWarnEl) {
          this.webviewWarnEl.setText(st && st.hasVideo
            ? "有播放器但还没拿到地址：点一下画面里的播放键试试"
            : "页面已加载（没找到 <video>）：视频可能需要登录或点播放");
        }
      }
    };
    setTimeout(poll, 700);
  }

  /** 在 webview 里执行一段 JS（失败静默返回 null） */
  async webviewExec(code) {
    const wv = this.webviewEl;
    if (!wv || typeof wv.executeJavaScript !== "function") return null;
    try { return await wv.executeJavaScript(code, true); } catch (e) { return null; }
  }

  webviewSeek(sec) {
    const s = Math.max(0, sec || 0);
    this.lastKnownTime = s;
    this.webviewExec(`(() => { const v = document.querySelector('video'); if (v) { v.currentTime = ${s}; v.play().catch(() => {}); } return 1; })()`);
  }

  webviewTogglePlay() {
    this.webviewExec("(() => { const v = document.querySelector('video'); if (v) { if (v.paused) v.play().catch(() => {}); else v.pause(); } return 1; })()");
  }

  mountIframe(src) {
    if (!src) return;
    this.iframeEl = this.stage.createEl("iframe", {
      attr: { src, allow: "autoplay; fullscreen; picture-in-picture", allowfullscreen: "true", referrerpolicy: "no-referrer" },
    });
    this.timer = setInterval(() => this.tick(), 500);
    this.updateClock();
  }

  /** 原生播放器：视频 + 可选独立音轨（DASH）+ 自绘控制条 */
  mountNativePlayer(videoSrc, opts) {
    opts = opts || {};
    this.destroyPlayerChrome();

    const wrap = this.stage.createDiv({ cls: "vns-player" });

    this.videoEl = wrap.createEl("video", { cls: "vns-video", attr: { playsinline: "true", preload: "metadata" } });
    this.videoEl.src = videoSrc;
    if (opts.title) this.videoEl.title = opts.title;

    // DASH 音轨单独播放，与视频同步
    if (opts.audioSrc) {
      this.audioEl = wrap.createEl("audio", { cls: "vns-audio", attr: { preload: "auto" } });
      this.audioEl.src = opts.audioSrc;
    }

    // 中央加载/重试提示
    this.playerMsg = wrap.createDiv({ cls: "vns-player-msg is-hidden" });

    // ---- 控制条 ----
    const bar = wrap.createDiv({ cls: "vns-ctl" });

    // 进度条
    const progRow = bar.createDiv({ cls: "vns-ctl-progress" });
    this.progFill = progRow.createDiv({ cls: "vns-ctl-progress-fill" });
    this.progBuf = progRow.createDiv({ cls: "vns-ctl-progress-buffer" });
    this.progTrack = progRow;

    // 按钮行
    const row = bar.createDiv({ cls: "vns-ctl-row" });
    const mkBtn = (parent, cls, label, title, fn) => {
      const b = parent.createEl("button", { cls: `vns-ctl-btn ${cls || ""}`, text: label });
      if (title) b.title = title;
      b.addEventListener("click", (ev) => { ev.preventDefault(); fn(); });
      return b;
    };

    this.playBtn = mkBtn(row, "vns-ctl-play", "▶", "播放 / 暂停", () => this.togglePlay());
    this.ctlTime = row.createSpan({ cls: "vns-ctl-time", text: "0:00 / 0:00" });
    row.createDiv({ cls: "vns-ctl-spacer" });

    // 倍速
    this.rateBtn = mkBtn(row, "vns-ctl-rate", "1.0x", "播放速度", () => this.cycleRate());
    // 画质
    if (opts.qualities && opts.qualities.length) {
      this.qualityBtn = mkBtn(row, "vns-ctl-quality", biliQualityLabel(opts.currentQn) || "画质", "切换画质", () => this.showQualityMenu(opts.qualities, opts.currentQn));
    }
    // 音量
    const volWrap = row.createDiv({ cls: "vns-ctl-vol" });
    this.muteBtn = mkBtn(volWrap, "vns-ctl-mute", "🔊", "静音", () => this.toggleMute());
    this.volSlider = volWrap.createEl("input", { cls: "vns-ctl-vol-slider", attr: { type: "range", min: "0", max: "100", value: "100" } });
    this.volSlider.addEventListener("input", () => this.setVolume(Number(this.volSlider.value) / 100));
    // 全屏
    mkBtn(row, "vns-ctl-fs", "⛶", "全屏", () => this.toggleFullscreen(wrap));

    // ---- 交互 ----
    this.videoEl.addEventListener("loadedmetadata", () => {
      if (opts.startAt > 0) this.seek(opts.startAt);
      this.updateClock();
      this.setStatus("就绪");
    });
    this.videoEl.addEventListener("error", () => {
      this.showPlayerMsg("视频加载失败（直链可能已过期），点此重试", () => {
        if (this.link && this.link.kind === "bilibili") this.loadBilibili(this.link, this.currentTime());
        else this.mountNativePlayer(videoSrc, opts);
      });
      this.setStatus("加载失败");
      if (this.link && this.link.kind === "bilibili" && this.biliStream) {
        // 直链过期 → 回退 iframe
        new Notice("B站 直链已过期，已回退内嵌播放器", 6000);
        this.mountIframe(embedFor(this.link, this.currentTime()));
      }
    });
    this.videoEl.addEventListener("play", () => { this.playBtn.setText("⏸"); this.setStatus("播放中"); this.syncAudio(); });
    this.videoEl.addEventListener("pause", () => { this.playBtn.setText("▶"); this.setStatus("已暂停"); this.syncAudio(); });
    this.videoEl.addEventListener("durationchange", () => this.updateClock());
    this.videoEl.addEventListener("timeupdate", () => this.renderProgress());
    this.videoEl.addEventListener("progress", () => this.renderProgress());
    this.videoEl.addEventListener("click", () => this.togglePlay());
    this.videoEl.addEventListener("dblclick", () => this.toggleFullscreen(wrap));

    // 进度条点击/拖拽
    let dragging = false;
    const seekFromEvent = (ev) => {
      const rect = this.progTrack.getBoundingClientRect();
      const ratio = Math.min(1, Math.max(0, (ev.clientX - rect.left) / rect.width));
      if (isFinite(this.videoEl.duration)) this.seek(ratio * this.videoEl.duration);
    };
    this.progTrack.addEventListener("mousedown", (ev) => { dragging = true; seekFromEvent(ev); });
    window.addEventListener("mousemove", (ev) => { if (dragging) seekFromEvent(ev); });
    window.addEventListener("mouseup", () => { dragging = false; });

    // 键盘快捷键（仅当焦点在播放器内）
    this.videoEl.tabIndex = 0;
    this.videoEl.addEventListener("keydown", (ev) => {
      if (ev.key === " ") { ev.preventDefault(); this.togglePlay(); }
      else if (ev.key === "ArrowRight") { ev.preventDefault(); this.seek(this.currentTime() + 5); }
      else if (ev.key === "ArrowLeft") { ev.preventDefault(); this.seek(this.currentTime() - 5); }
      else if (ev.key === "f") { this.toggleFullscreen(wrap); }
    });

    this.setVolume(Number(this.volSlider.value) / 100);
    if (opts.autoplay) { this.videoEl.play().catch(() => {}); }
    this.timer = setInterval(() => this.tick(), 500);
    this.renderProgress();
    this.updateClock();
  }

  destroyPlayerChrome() {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    if (this.videoEl) { try { this.videoEl.pause(); } catch (e) { /* ignore */ } }
    if (this.audioEl) { try { this.audioEl.pause(); } catch (e) { /* ignore */ } }
    if (this.qualityMenu) { this.qualityMenu.remove(); this.qualityMenu = null; }
  }

  showPlayerMsg(text, onClick) {
    if (!this.playerMsg) return;
    this.playerMsg.setText(text);
    this.playerMsg.removeClass("is-hidden");
    this.playerMsg.onclick = () => { this.playerMsg.addClass("is-hidden"); if (onClick) onClick(); };
  }

  hidePlayerMsg() { if (this.playerMsg) this.playerMsg.addClass("is-hidden"); }

  togglePlay() {
    if (this.webviewEl) { this.webviewTogglePlay(); return; }
    if (!this.videoEl) return;
    if (this.videoEl.paused) this.videoEl.play().catch((e) => this.showPlayerMsg(`播放失败：${e.message}`));
    else this.videoEl.pause();
  }

  syncAudio() {
    if (!this.audioEl || !this.videoEl) return;
    if (Math.abs((this.audioEl.currentTime || 0) - (this.videoEl.currentTime || 0)) > 0.3) {
      this.audioEl.currentTime = this.videoEl.currentTime || 0;
    }
    if (this.videoEl.paused) this.audioEl.pause();
    else this.audioEl.play().catch(() => {});
  }

  toggleMute() {
    if (!this.videoEl) return;
    const muted = !this.videoEl.muted;
    this.videoEl.muted = muted;
    if (this.audioEl) this.audioEl.muted = muted;
    this.muteBtn.setText(muted ? "🔇" : "🔊");
  }

  setVolume(v) {
    const vol = Math.min(1, Math.max(0, v));
    if (this.videoEl) this.videoEl.volume = vol;
    if (this.audioEl) this.audioEl.volume = vol;
  }

  cycleRate() {
    const rates = [1, 1.25, 1.5, 2, 0.75];
    const cur = this.videoEl ? this.videoEl.playbackRate : 1;
    const idx = rates.findIndex((r) => Math.abs(r - cur) < 0.01);
    const next = rates[(idx + 1) % rates.length];
    if (this.videoEl) this.videoEl.playbackRate = next;
    if (this.audioEl) this.audioEl.playbackRate = next;
    if (this.rateBtn) this.rateBtn.setText(`${next.toFixed(next % 1 === 0 ? 1 : 2)}x`);
  }

  toggleFullscreen(el) {
    const target = el || this.stage;
    if (document.fullscreenElement) document.exitFullscreen();
    else target.requestFullscreen && target.requestFullscreen();
  }

  showQualityMenu(qualities, currentQn) {
    this.hideQualityMenu();
    const menu = createDiv({ cls: "vns-quality-menu" });
    for (const q of qualities) {
      const item = menu.createDiv({
        cls: `vns-quality-item ${q.qn === currentQn ? "is-current" : ""} ${q.available === false ? "is-locked" : ""}`,
        text: q.available === false ? `${q.label} （需登录/会员）` : q.label,
      });
      item.addEventListener("click", () => {
        if (q.available === false) { new Notice(`「${q.label}」需要登录对应账号或更高权限`, 5000); return; }
        this.switchBiliQuality(q.qn);
      });
      menu.appendChild(item);
    }
    this.qualityMenu = menu;
    document.body.appendChild(menu);
    const rect = this.qualityBtn.getBoundingClientRect();
    menu.style.left = `${rect.left}px`;
    menu.style.top = `${Math.max(8, rect.top - menu.offsetHeight - 8)}px`;
  }

  hideQualityMenu() {
    if (this.qualityMenu) { this.qualityMenu.remove(); this.qualityMenu = null; }
  }

  renderProgress() {
    if (!this.videoEl || !this.progFill) return;
    const dur = this.videoEl.duration || this.link && this.link.duration || 0;
    const cur = this.videoEl.currentTime || 0;
    const pct = dur > 0 ? Math.min(100, (cur / dur) * 100) : 0;
    this.progFill.style.width = `${pct}%`;
    try {
      if (this.videoEl.buffered && this.videoEl.buffered.length) {
        const bufEnd = this.videoEl.buffered.end(this.videoEl.buffered.length - 1);
        this.progBuf.style.width = dur > 0 ? `${Math.min(100, (bufEnd / dur) * 100)}%` : "0%";
      }
    } catch (e) { /* ignore */ }
    if (this.ctlTime) {
      this.ctlTime.setText(`${fmtTime(cur)} / ${dur && !isNaN(dur) ? fmtTime(dur) : "0:00"}`);
    }
  }

  seek(sec) {
    const s = Math.max(0, sec || 0);
    if (!this.link) return;
    this.lastKnownTime = s;
    if (this.videoEl) {
      try {
        this.videoEl.currentTime = s;
        if (this.audioEl) this.audioEl.currentTime = s;
        this.videoEl.play().catch(() => {});
      } catch (e) { /* ignore */ }
      this.updateClock();
      this.renderProgress();
      return;
    }
    if (this.iframeEl) {
      if (this.link.kind === "youtube") {
        this.iframeEl.contentWindow.postMessage(
          JSON.stringify({ event: "command", func: "seekTo", args: [s, true] }), "*");
      } else if (this.link.kind === "bilibili") {
        this.iframeEl.src = embedFor(this.link, s);
      }
      return;
    }
    if (this.webviewEl) this.webviewSeek(s);
  }

  tick() {
    if (this.videoEl) {
      this.lastKnownTime = this.videoEl.currentTime || 0;
      if (this.audioEl && !this.videoEl.paused) this.syncAudio();
    } else if (this.iframeEl && this.link && this.link.kind === "youtube") {
      try {
        this.iframeEl.contentWindow.postMessage(
          JSON.stringify({ event: "command", func: "getCurrentTime", args: [] }), "*");
      } catch (e) { /* 跨域忽略 */ }
    } else if (this.webviewEl) {
      this.webviewExec("(() => { const vids = Array.from(document.querySelectorAll('video')).filter((x) => x.videoWidth > 0 && x.videoHeight > 0).sort((a, b) => (b.videoWidth * b.videoHeight) - (a.videoWidth * a.videoHeight)); const v = vids[0] || document.querySelector('video'); return v ? JSON.stringify({ t: v.currentTime, w: v.videoWidth, h: v.videoHeight }) : ''; })()")
        .then((raw) => {
          let st = null;
          try { st = raw ? JSON.parse(raw) : null; } catch (e) { /* 兼容旧返回 */ }
          if (st && typeof st === "object") {
            if (typeof st.t === "number" && st.t >= 0) this.lastKnownTime = st.t;
            if (this.immersive && this.plugin.settings.douyinAspectFit !== false && st.w > 0 && st.h > 0) {
              this.fitStageToAspect(st.w / st.h);
            }
          } else if (typeof raw === "number" && raw >= 0) {
            this.lastKnownTime = raw;
          }
        })
        .catch(() => {});
    } else if (this.iframeEl) {
      this.lastKnownTime += 0.5;
    }
    this.updateClock();
  }

  updateClock() {
    // 底部状态栏已移除；此方法保留为空，兼容内部调用点
  }

  currentTime() {
    if (this.videoEl) return this.videoEl.currentTime || 0;
    return this.lastKnownTime || 0;
  }

  /** 播放器时长（webview / iframe 场景也可用） */
  currentDuration() {
    if (this.videoEl && isFinite(this.videoEl.duration)) return this.videoEl.duration || 0;
    return (this.link && this.link.duration) || 0;
  }

  async captureTimestamp() {
    if (!this.link) { new Notice("先加载一个视频"); return; }
    const t = await this.plugin.askTime(this.currentTime(), this.currentDuration());
    if (t === null) return;
    const url = tsLink(this.link, t, this.plugin.settings.timestampMode);
    const line = `- [${fmtTime(t)}](${url}) `;
    await this.plugin.insertIntoActiveNote(line, this.link);
    this.plugin.recordHabit("timestamp");
    new Notice(`已插入时间戳 ${fmtTime(t)}`);
  }

  async generateCanvas() {
    const raw = this.link ? this.link.url : String(this.urlInput.value || "").trim();
    if (!raw) { new Notice("先加载视频或粘贴链接"); return; }
    this.setStatus("生成 Canvas…");
    try {
      const boundPath = this.notePath || (this.link && this.plugin.noteIndex.get(this.link.url));
      let file = boundPath ? this.app.vault.getAbstractFileByPath(normalizePath(boundPath)) : null;
      if (!(file instanceof TFile)) file = await this.plugin.importLink(raw, { player: this });
      if (!(file instanceof TFile)) throw new Error("没有可用于拆解的笔记");
      const markdown = await this.app.vault.read(file);
      const canvasPath = await this.plugin.makeCanvas(file.basename, markdown, this.plugin.settings.canvasFolder);
      await this.plugin.linkCanvasInNote(file, canvasPath);
      const canvasFile = this.app.vault.getAbstractFileByPath(normalizePath(canvasPath));
      if (canvasFile instanceof TFile) await this.app.workspace.getLeaf("tab").openFile(canvasFile);
      this.setStatus("Canvas 已生成");
    } catch (e) {
      this.setStatus("Canvas 生成失败");
      this.plugin.fail(e);
    }
  }

  async openNote() {
    const path = this.notePath || this.plugin.noteIndex.get(this.link ? this.link.url : "");
    if (!path) { new Notice("还没绑定笔记，先点「生成笔记」"); return; }
    const f = this.app.vault.getAbstractFileByPath(path);
    if (f) await this.app.workspace.getLeaf(true).openFile(f);
  }
}

/* ============================ 设置页 ============================ */

/* ============================ 抖音收藏同步面板 ============================ */

class DouyinFavSyncModal extends Modal {
  constructor(app, plugin, opts) {
    super(app);
    this.plugin = plugin;
    this.opts = opts || {};
    this.stopped = false;
    this.wv = null;
  }

  onOpen() {
    this.titleEl.setText("同步抖音收藏");
    const wrap = this.contentEl.createDiv({ cls: "vns-fav-wrap" });
    this.statusEl = wrap.createDiv({ cls: "vns-fav-status", text: "正在打开抖音收藏页…" });
    this.hintEl = wrap.createDiv({ cls: "vns-fav-hint", text: "这个窗口用来读取你的收藏：如果没登录，直接在这里登录（扫码/账号），登录状态会保留，下次不用再登。" });
    const frame = wrap.createDiv({ cls: "vns-fav-frame" });
    this.wv = document.createElement("webview");
    this.wv.setAttribute("partition", DOUYIN_PARTITION);
    this.wv.setAttribute("src", "https://www.douyin.com/user/self?showTab=favorite_collection");
    this.wv.setAttribute("webpreferences", "backgroundThrottling=false");
    this.wv.className = "vns-webview";
    frame.appendChild(this.wv);
    const actions = wrap.createDiv({ cls: "vns-fav-actions" });
    this.stopBtn = actions.createEl("button", { text: "停止" });
    this.stopBtn.onclick = () => { this.stopped = true; this.setStatus("已停止"); };
    this.openBtn = actions.createEl("button", { text: "打开收藏文件夹" });
    this.openBtn.onclick = () => this.plugin.app.workspace.openLinkText(this.plugin.settings.favFolder || "抖音收藏", "", false);
    this.logEl = wrap.createDiv({ cls: "vns-fav-log" });

    this.run().catch((e) => {
      this.setStatus(`同步失败：${e.message}`);
      this.log(`❌ ${e.message}`);
    });
  }

  onClose() {
    this.stopped = true;
    if (this.plugin) this.plugin._favSyncing = false;
    try { if (this.wv) this.wv.remove(); } catch (e) { /* ignore */ }
    this.wv = null;
    this.contentEl.empty();
  }

  setStatus(text) { if (this.statusEl) this.statusEl.setText(text); }

  log(text) {
    if (!this.logEl) return;
    this.logEl.createDiv({ text });
    this.logEl.scrollTop = this.logEl.scrollHeight;
  }

  async run() {
    const p = this.plugin;
    p._favSyncing = true;
    const limit = Math.max(1, Math.min(200, parseInt(this.opts.limit || p.settings.favLimit, 10) || 20));
    const mode = this.opts.mode || (p.settings.favMode === "heavy" ? "heavy" : "light");
    const dmin = Math.max(1, Number(p.settings.favPageDelayMin) || 6);
    const dmax = Math.max(dmin, Number(p.settings.favPageDelayMax) || 12);

    this.setStatus("等待抖音页面就绪（首次可能需要在下方窗口登录）…");
    const ready = await p.waitFavSigner(this.wv, 60000);
    if (!ready) {
      this.setStatus("抖音页面没就绪：请在下方的窗口里登录一次，然后关闭本窗口重新点「同步抖音收藏」");
      return;
    }
    this.log("✅ 页面就绪，开始读取收藏列表");
    const index = await p.loadFavIndex();
    let cursor = 0;
    let imported = 0;
    let skipped = 0;
    let failed = 0;
    let pages = 0;
    let riskHits = 0;

    while (!this.stopped && imported < limit && pages < 40) {
      pages += 1;
      this.setStatus(`读取第 ${pages} 页…（新增 ${imported} / 跳过 ${skipped}）`);
      const need = Math.min(20, Math.max(1, limit - imported));
      const res = await p.fetchDouyinFavPage(this.wv, cursor, need);
      if (!res || !res.ok) {
        if (res && res.blocked && riskHits < 2) {
          riskHits += 1;
          this.log(`⚠️ 被风控拦了（第 ${riskHits} 次），等 30 秒再试…`);
          await new Promise((r) => setTimeout(r, 30000));
          continue;
        }
        this.log(`❌ 第 ${pages} 页读取失败：${(res && (res.err || res.status)) || "未知错误"}`);
        if (res && res.err && /webSignUrl/.test(res.err)) {
          this.setStatus("页面还没登录或没加载完，请在上面的窗口登录后重试");
        }
        break;
      }
      const items = res.items || [];
      if (pages === 1 && res.total) this.log(`📚 收藏夹共 ${res.total} 条`);
      if (!items.length) {
        this.log("🈳 没有更多收藏了" + (pages === 1 ? "（如果确实有收藏，可能是没登录）" : ""));
        break;
      }
      for (const item of items) {
        if (this.stopped || imported >= limit) break;
        if (!item || !item.id) continue;
        if (index[item.id]) {
          const exists = p.app.vault.getAbstractFileByPath(index[item.id]);
          if (exists) { skipped += 1; continue; }
          delete index[item.id];
        }
        try {
          this.setStatus(`转换 ${imported + 1}/${limit}：${String(item.desc || item.id).replace(/\n/g, " ").slice(0, 30)}`);
          const path = await p.importFavItem(item, mode, {
            summarize: p.settings.autoSummarize,
            transcribe: mode === "heavy",
          });
          index[item.id] = path;
          await p.saveFavIndex(index);
          imported += 1;
          this.log(`✅ ${path}`);
        } catch (e) {
          failed += 1;
          this.log(`❌ ${item.id}：${e.message}`);
        }
      }
      if (!res.hasMore || !res.cursor) break;
      cursor = res.cursor;
      if (!this.stopped && imported < limit) {
        const wait = Math.round((dmin + Math.random() * (dmax - dmin)) * 1000);
        this.setStatus(`翻页前等待 ${Math.round(wait / 1000)} 秒（避免风控）…`);
        await new Promise((r) => setTimeout(r, wait));
      }
    }

    const parts = [`新增 ${imported} 篇`];
    if (skipped) parts.push(`跳过 ${skipped} 篇`);
    if (failed) parts.push(`失败 ${failed} 篇`);
    this.setStatus(`✅ 完成：${parts.join("，")}`);
    p._favSyncing = false;
    p.settings.favLastSync = Date.now();
    try { await p.saveSettings(); } catch (e) { /* ignore */ }
    if (imported) new Notice(`抖音收藏：新增 ${imported} 篇笔记`, 8000);
  }
}

class VnsSettingTab extends PluginSettingTab {
  constructor(app, plugin) { super(app, plugin); this.plugin = plugin; }

  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Video Note Studio" });
    const s = this.plugin.settings;

    const text = (name, key, desc, ph) => new Setting(containerEl).setName(name).setDesc(desc || "")
      .addText((t) => t.setPlaceholder(ph || "").setValue(s[key] ?? "")
        .onChange(async (v) => { s[key] = v.trim(); await this.plugin.saveSettings(); }));

    const toggle = (name, key, desc) => new Setting(containerEl).setName(name).setDesc(desc || "")
      .addToggle((t) => t.setValue(!!s[key])
        .onChange(async (v) => { s[key] = v; await this.plugin.saveSettings(); }));

    containerEl.createEl("h3", { text: "笔记与目录" });
    text("收件箱目录", "inboxFolder", "贴链接生成的笔记落到这里", "Clippings");
    text("Canvas 目录", "canvasFolder", "自动生成的拆解白板", "Canvas");
    text("OCR 目录", "ocrFolder", "图片转写的笔记", "Clippings/OCR");
    text("拆书目录", "bookFolder", "拆书结果输出位置", "Books");
    new Setting(containerEl).setName("播放器打开方式").setDesc("split 分屏 / tab 新标签页 / window 独立窗口")
      .addDropdown((d) => d.addOption("split", "分屏").addOption("tab", "新标签页").addOption("window", "独立窗口")
        .setValue(s.playerSplit).onChange(async (v) => { s.playerSplit = v; await this.plugin.saveSettings(); }));
    new Setting(containerEl).setName("时间戳点击行为").setDesc("笔记里的 [0:29] 点下去要做什么")
      .addDropdown((d) => d.addOption("inapp", "在播放器里跳转播放").addOption("browser", "打开网页定位")
        .setValue(s.timestampMode || "inapp").onChange(async (v) => { s.timestampMode = v; await this.plugin.saveSettings(); }));

    containerEl.createEl("h3", { text: "抓取与转录" });
    text("yt-dlp 路径", "ytDlpPath", "用于取 B站/YouTube 字幕；留空不做转录", "yt-dlp");
    text("优先字幕语言", "subsLangs", "逗号分隔，按顺序尝试", "zh-Hans,zh-CN,zh,en");
    toggle("没有字幕时用本地 Whisper 转录", "asrEnabled", "调用插件自带的 asr_bridge.py，需要本机已装 Python + faster-whisper");
    text("Python 路径", "pythonPath", "调用 asr_bridge.py 的解释器", "python");
    text("Whisper 模型", "asrModel", "tiny / base / small / medium，越大越准越慢", "small");
    text("转录语言", "asrLanguage", "留空自动检测，或填 zh / en", "");
    new Setting(containerEl).setName("B站账号").setDesc(this.plugin.hasBiliLogin()
      ? `已登录${this.plugin.settings.biliUser && this.plugin.settings.biliUser.uname ? `：${this.plugin.settings.biliUser.uname}` : ""}；视频使用账号可用清晰度`
      : "扫码登录后，B站播放器使用你的账号可用清晰度")
      .addButton((b) => b.setButtonText(this.plugin.hasBiliLogin() ? "管理登录" : "扫码登录").onClick(() => {
        new BiliLoginModal(this.app, this.plugin, async () => this.display()).open();
      }));
    new Setting(containerEl).setName("B站 播放").setDesc("默认用内嵌播放器（稳定）；想要原生控制条可开启下方开关")
      .addButton((b) => b.setButtonText("测试直链").onClick(async () => {
        b.setDisabled(true);
        try {
          const r = await this.plugin.diagnoseBiliStream();
          new Notice(r, 15000);
        } catch (e) { new Notice(`诊断失败：${e.message}`, 15000); }
        finally { b.setDisabled(false); }
      }));
    toggle("打开笔记时自动打开播放器", "autoOpenPlayerOnNote", "打开带 source 视频链接的笔记时，自动在播放器里加载该视频（不抢焦点）");
    toggle("B站 使用原生播放器（实验）", "biliNative", "走 playurl 直链 + 自绘控制条；失败会自动回退内嵌播放器。目前部分环境解析不通，默认关闭");

    containerEl.createEl("h3", { text: "抖音" });
    toggle("抖音使用内嵌浏览器播放", "douyinWebview",
      "用 Electron webview 打开抖音官方播放页（iframe 会被 X-Frame-Options 和反嵌脚本挡住）。关闭后只能生成笔记，不能内嵌播放");
    toggle("网页用内嵌浏览器打开", "webviewPages",
      "普通网页 / 公众号 / 网盘链接改用 webview 打开，能播出被 iframe 拦死的网页视频；关掉则退回 iframe 或提示");
    toggle("抖音默认沉浸（只留视频）", "douyinImmersive",
      "打开抖音播放页时隐藏头尾/评论区，只留视频本体；播放器右上角「退出沉浸」可随时恢复整页");
    toggle("沉浸模式按视频比例适配（去黑边，不裁内容）", "douyinAspectFit",
      "沉浸时把播放区缩放成视频的真实比例，画面完整显示、上下黑边消失；关掉则播放区固定大小（可能带黑边）。播放器右上角「比例」按钮可随时切换");
    new Setting(containerEl).setName("抖音 Cookie").setDesc(`${this.plugin.douyinCookieInfo()}。打开抖音播放页或生成笔记时自动抓取，供 yt-dlp / 转录使用`)
      .addButton((b) => b.setButtonText("重新抓取").onClick(async () => {
        b.setDisabled(true);
        try {
          const r = await this.plugin.probeDouyinCookies();
          new Notice(r && r.cookie ? `已抓取抖音 Cookie：${this.plugin.douyinCookieInfo()}` : "没抓到 Cookie，试试在窗口里登录一次", 8000);
          this.display();
        } catch (e) {
          new Notice(`抓取失败：${e.message}`, 8000);
        } finally { b.setDisabled(false); }
      }))
      .addButton((b) => b.setButtonText("清空").onClick(async () => {
        this.plugin.settings.douyinCookieHeader = "";
        this.plugin.settings.douyinCookieAt = 0;
        await this.plugin.saveSettings();
        this.display();
      }));
    containerEl.createEl("h4", { text: "抖音收藏同步" });
    new Setting(containerEl).setName("收藏笔记目录").setDesc("每一条收藏生成一篇笔记，放在这个目录")
      .addText((t) => t.setPlaceholder("抖音收藏").setValue(this.plugin.settings.favFolder || "抖音收藏")
        .onChange(async (v) => { this.plugin.settings.favFolder = v.trim() || "抖音收藏"; await this.plugin.saveSettings(); }));
    new Setting(containerEl).setName("附件目录").setDesc("封面、配图、视频放这里（heavy 模式会下载视频）")
      .addText((t) => t.setPlaceholder("抖音收藏/附件").setValue(this.plugin.settings.favAttachFolder || "抖音收藏/附件")
        .onChange(async (v) => { this.plugin.settings.favAttachFolder = v.trim() || "抖音收藏/附件"; await this.plugin.saveSettings(); }));
    new Setting(containerEl).setName("同步模式").setDesc("轻量：文案 + 封面 + 链接；重量：再下载视频并做本地转录（慢，占用空间）")
      .addDropdown((d) => d
        .addOption("light", "轻量：文案 + 封面")
        .addOption("heavy", "重量：下载视频 + 转录")
        .setValue(this.plugin.settings.favMode || "light")
        .onChange(async (v) => { this.plugin.settings.favMode = v; await this.plugin.saveSettings(); }));
    new Setting(containerEl).setName("每次同步条数").setDesc("一次最多转换多少条收藏（1-200），已转换过的会自动跳过")
      .addText((t) => t.setValue(String(this.plugin.settings.favLimit || 20))
        .onChange(async (v) => {
          const n = Math.max(1, Math.min(200, parseInt(v, 10) || 20));
          this.plugin.settings.favLimit = n;
          await this.plugin.saveSettings();
        }));
    new Setting(containerEl).setName("翻页间隔（秒）").setDesc("两页之间随机等待，太短容易触发风控")
      .addText((t) => t.setValue(String(this.plugin.settings.favPageDelayMin || 6))
        .onChange(async (v) => { this.plugin.settings.favPageDelayMin = Math.max(1, parseInt(v, 10) || 6); await this.plugin.saveSettings(); }))
      .addText((t) => t.setValue(String(this.plugin.settings.favPageDelayMax || 12))
        .onChange(async (v) => { this.plugin.settings.favPageDelayMax = Math.max(1, parseInt(v, 10) || 12); await this.plugin.saveSettings(); }));
    new Setting(containerEl).setName("启动时自动同步").setDesc("开启后，Obsidian 启动时如果距上次同步超过 12 小时，就自动跑一次（会弹出同步窗口）")
      .addToggle((t) => t.setValue(!!this.plugin.settings.favAutoSync)
        .onChange(async (v) => { this.plugin.settings.favAutoSync = v; await this.plugin.saveSettings(); }));
    new Setting(containerEl).setName("定时同步间隔（分钟）").setDesc("0 = 关闭；大于 0 时，Obsidian 开着就按间隔自动同步（会弹出同步窗口）。官方插件建议 ≥10 分钟、每批 5 条以内，太快容易触发风控")
      .addText((t) => t.setValue(String(this.plugin.settings.favEveryMin || 0))
        .onChange(async (v) => {
          this.plugin.settings.favEveryMin = Math.max(0, Math.min(1440, parseInt(v, 10) || 0));
          await this.plugin.saveSettings();
        }));
    const favNow = new Setting(containerEl).setName("立即同步").setDesc("打开收藏同步面板，可先在里面登录抖音")
      .addButton((b) => b.setButtonText("同步收藏").setCta().onClick(() => this.plugin.openFavSync()));
    this.plugin.loadFavIndex().then((idx) => {
      const n = Object.keys(idx || {}).length;
      const at = this.plugin.settings.favLastSync ? new Date(this.plugin.settings.favLastSync).toLocaleString() : "从未";
      favNow.setDesc(`已同步 ${n} 条 ｜ 上次同步：${at} ｜ 打开面板后可在窗口里登录抖音`);
    }).catch(() => {});
    new Setting(containerEl).setName("测试本地转录").setDesc("检查 Python、faster-whisper 与 asr_bridge.py 是否就位")
      .addButton((b) => b.setButtonText("运行测试").onClick(async () => {
        b.setDisabled(true);
        try { new Notice(await this.plugin.testBridge(), 12000); } finally { b.setDisabled(false); }
      }));

    containerEl.createEl("h3", { text: "模型 API" });
    new Setting(containerEl).setName("使用 magpie 路由").setDesc("直连本机 magpie 网关（OpenAI 兼容），无需 API Key；开启后忽略下方 Base URL / Key / 模型")
      .addToggle((t) => t.setValue(!!s.magpieEnabled).onChange(async (v) => { s.magpieEnabled = v; await this.plugin.saveSettings(); this.display(); }));
    if (s.magpieEnabled) {
      text("magpie 地址", "magpieBaseUrl", "本机 magpie 网关的 OpenAI 兼容入口", "http://127.0.0.1:3425/v1");

      // 模型选择：下拉列表 + 刷新按钮
      const modelSetting = new Setting(containerEl).setName("magpie 模型").setDesc("选择路由组或具体模型");
      const select = modelSetting.controlEl.createEl("select", { cls: "dropdown vns-model-select" });
      const currentModel = s.magpieModel || "auto/deepseek-v4.1-flash";
      const cachedModels = (this.plugin.magpieModels || []);
      const populateOptions = (models) => {
        select.empty();
        for (const m of models) {
          const opt = select.createEl("option", { value: m, text: m });
          if (m === currentModel) opt.selected = true;
        }
        // 当前模型不在列表里也要能选到
        if (!models.includes(currentModel)) {
          const opt = select.createEl("option", { value: currentModel, text: currentModel });
          opt.selected = true;
        }
      };
      populateOptions(cachedModels.length ? cachedModels : [currentModel]);
      select.addEventListener("change", async () => {
        s.magpieModel = select.value;
        await this.plugin.saveSettings();
      });

      modelSetting.addButton((b) => b.setButtonText("刷新").onClick(async () => {
        b.setDisabled(true);
        b.setButtonText("拉取中…");
        try {
          const models = await this.plugin.fetchMagpieModels();
          this.plugin.magpieModels = models;
          populateOptions(models);
          new Notice(`拉到 ${models.length} 个模型`);
        } catch (e) { new Notice(`拉取失败：${e.message}`, 8000); }
        finally { b.setDisabled(false); b.setButtonText("刷新"); }
      }));

      new Setting(containerEl).setName("测试 magpie 连接").setDesc("发一条最小请求，确认网关可用")
        .addButton((b) => b.setButtonText("测试").onClick(async () => {
          b.setDisabled(true);
          try {
            const reply = await chat(this.plugin.settings, [{ role: "user", content: "只回复两个字：通了" }], { maxTokens: 16 });
            new Notice(`magpie 可用 → ${reply}`, 8000);
          } catch (e) { new Notice(`magpie 不可用：${e.message}`, 12000); }
          finally { b.setDisabled(false); }
        }));
    } else {
      text("Base URL", "llmBaseUrl", "OpenAI 兼容，例如 https://api.deepseek.com/v1", "https://api.deepseek.com/v1");
      text("API Key", "llmApiKey", "只存在本机 data.json", "");
      text("对话模型", "llmModel", "用于摘要/翻译/拆书/Canvas", "deepseek-chat");
      text("视觉模型", "visionModel", "用于 OCR；留空则 OCR 不可用", "gpt-4o-mini");
    }
    toggle("生成笔记时自动摘要", "autoSummarize");
    toggle("自动翻译为中文", "autoTranslate", "英文视频/文章会追加中文译文");
    text("翻译目标语言", "translateTo", "", "zh");
    toggle("生成笔记时自动画 Canvas", "autoCanvas");

    containerEl.createEl("h3", { text: "Obsidian Web Clipper 兼容" });
    toggle("兼容 Web Clipper 剪藏", "clipperCompat", "生成/补全时沿用 clippings 字段与标签");
    text("剪藏标签", "clipperTags", "写入 frontmatter 的 tags", "clippings");

    containerEl.createEl("h3", { text: "使用习惯" });
    toggle("记录使用习惯", "habitEnabled", "把常用操作沉淀成一份笔记，供后续开发参考");
    text("习惯笔记路径", "habitNote", "", "_meta/使用习惯.md");

    new Setting(containerEl).setName("清空使用习惯").setDesc("只清空统计，不删除已生成的笔记")
      .addButton((b) => b.setButtonText("清空").setWarning().onClick(async () => {
        s.habits = { counters: {}, events: [] };
        await this.plugin.saveSettings();
        new Notice("使用习惯已清空");
      }));
  }
}

/* ============================ 模型 & yt-dlp ============================ */

async function chat(settings, messages, opts = {}) {
  const useMagpie = !!settings.magpieEnabled;
  if (!useMagpie && !settings.llmApiKey) {
    throw new Error("还没配置模型 API Key（设置 → Video Note Studio；或开启「使用 magpie 路由」）");
  }
  const base = useMagpie
    ? (settings.magpieBaseUrl || "http://127.0.0.1:3425/v1")
    : settings.llmBaseUrl;
  const model = useMagpie
    ? (opts.model || settings.magpieModel || "auto/deepseek-v4.1-flash")
    : (opts.model || settings.llmModel);
  const headers = { "Content-Type": "application/json" };
  if (!useMagpie && settings.llmApiKey) headers.Authorization = `Bearer ${settings.llmApiKey}`;

  const url = `${String(base).replace(/\/+$/, "")}/chat/completions`;
  const res = await requestUrl({
    url, method: "POST", throw: false, headers,
    body: JSON.stringify({ model, messages, temperature: opts.temperature ?? 0.3, max_tokens: opts.maxTokens || 2048 }),
  });
  if (res.status >= 400) {
    const hint = useMagpie ? "（magpie 路由不可达？检查本地 magpie 服务是否在运行）" : "";
    throw new Error(`模型接口 ${res.status}${hint}: ${String(res.text || "").slice(0, 200)}`);
  }
  const data = res.json || JSON.parse(res.text || "{}");
  const msg = data.choices && data.choices[0] && data.choices[0].message;
  return (msg && msg.content ? msg.content : "").trim();
}

function runProcess(bin, args, cwd, timeoutMs) {
  return new Promise((resolve, reject) => {
    if (!cp) return reject(new Error("当前环境不能启动外部进程（仅桌面版支持）"));
    let out = "";
    let err = "";
    let timer = null;
    const p = cp.spawn(bin, args, { cwd, windowsHide: true });
    if (timeoutMs) {
      timer = setTimeout(() => {
        try { p.kill(); } catch (e) { /* ignore */ }
        reject(new Error(`外部进程超时（${Math.round(timeoutMs / 1000)}s）`));
      }, timeoutMs);
    }
    p.stdout.on("data", (d) => { out += d.toString("utf8"); });
    p.stderr.on("data", (d) => { err += d.toString("utf8"); });
    p.on("error", (e) => { if (timer) clearTimeout(timer); reject(new Error(`无法运行 ${bin}：${e.message}`)); });
    p.on("close", (code) => {
      if (timer) clearTimeout(timer);
      if (code === 0) resolve(out);
      else reject(new Error((err || `退出码 ${code}`).trim().slice(-800)));
    });
  });
}

/* ============================ 拆书 ============================ */

function parseEpub(buffer) {
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  const dec = new TextDecoder("utf-8");
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 66000); i -= 1) {
    if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("不是合法的 EPUB（找不到 zip 目录）");
  const count = view.getUint16(eocd + 10, true);
  let off = view.getUint32(eocd + 16, true);
  const files = [];
  for (let i = 0; i < count; i += 1) {
    if (view.getUint32(off, true) !== 0x02014b50) break;
    const method = view.getUint16(off + 10, true);
    const csize = view.getUint32(off + 20, true);
    const nameLen = view.getUint16(off + 28, true);
    const extraLen = view.getUint16(off + 30, true);
    const commentLen = view.getUint16(off + 32, true);
    const localOff = view.getUint32(off + 42, true);
    const name = dec.decode(bytes.subarray(off + 46, off + 46 + nameLen));
    files.push({ name, method, csize, localOff });
    off += 46 + nameLen + extraLen + commentLen;
  }
  const readEntry = (entry) => {
    const lo = entry.localOff;
    const nameLen = view.getUint16(lo + 26, true);
    const extraLen = view.getUint16(lo + 28, true);
    const start = lo + 30 + nameLen + extraLen;
    const raw = bytes.subarray(start, start + entry.csize);
    if (entry.method === 0) return new TextDecoder("utf-8").decode(raw);
    return require("zlib").inflateRawSync(raw).toString("utf8");
  };
  const chapters = [];
  for (const f of files) {
    if (!/\.x?html?$/i.test(f.name)) continue;
    try {
      const text = htmlToText(readEntry(f));
      if (text.length > 200) chapters.push({ name: f.name, text });
    } catch (e) { /* 跳过坏条目 */ }
  }
  chapters.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  return chapters;
}

function splitChapters(text) {
  const parts = String(text).split(/\n(?=#{1,2}\s|第[一二三四五六七八九十百零\d]+[章回节]\s?)/);
  return parts.filter((p) => p.trim().length > 200).map((p) => {
    const first = p.trim().split(/\r?\n/)[0].replace(/^#+\s*/, "").slice(0, 60);
    return { name: first || "章节", text: p.trim() };
  });
}

/* ============================ 选择器 / 弹窗 ============================ */

class LocalVideoSuggest extends FuzzySuggestModal {
  constructor(app, onPick) { super(app); this.onPick = onPick; this.setPlaceholder("选一个本地视频/音频文件"); }
  getItems() {
    return this.app.vault.getFiles().filter((f) => VIDEO_EXT.includes((f.extension || "").toLowerCase()));
  }
  getItemText(f) { return f.path; }
  onChooseItem(f) { this.onPick(f); }
}

class FilePickModal extends FuzzySuggestModal {
  constructor(app, exts, onPick, hint) {
    super(app);
    this.exts = exts;
    this.onPick = onPick;
    this.setPlaceholder(hint || "选一个文件");
  }
  getItems() { return this.app.vault.getFiles().filter((f) => this.exts.includes((f.extension || "").toLowerCase())); }
  getItemText(f) { return f.path; }
  onChooseItem(f) { this.onPick(f); }
}

class UrlModal extends Modal {
  constructor(app, onSubmit, initial) {
    super(app);
    this.onSubmit = onSubmit;
    this.initial = initial || "";
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.createEl("h3", { text: "贴一个链接" });
    const input = contentEl.createEl("input", { type: "text", cls: "vns-url" });
    input.style.width = "100%";
    input.value = this.initial;
    input.focus();
    const row = contentEl.createDiv();
    row.style.marginTop = "12px";
    const ok = row.createEl("button", { cls: "mod-cta", text: "生成笔记" });
    ok.addEventListener("click", () => { this.close(); this.onSubmit(input.value.trim()); });
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") { this.close(); this.onSubmit(input.value.trim()); } });
  }
  onClose() { this.contentEl.empty(); }
}

class TimeModal extends Modal {
  constructor(app, current, duration, resolve) {
    super(app);
    this.current = current;
    this.duration = duration;
    this.resolve = resolve;
    this.done = false;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.createEl("h3", { text: `打时间戳（当前 ${fmtTime(this.current)}）` });
    const input = contentEl.createEl("input", { type: "text" });
    input.style.width = "100%";
    input.value = fmtTime(this.current);
    input.focus();
    input.select();
    contentEl.createDiv({ cls: "vns-setting-note", text: "支持 90 / 1:30 / 1:02:03 三种写法" }).style.marginTop = "8px";
    const row = contentEl.createDiv();
    row.style.marginTop = "12px";
    row.createEl("button", { cls: "mod-cta", text: "插入" }).addEventListener("click", () => this.finish(input.value));
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") this.finish(input.value); });
  }
  finish(value) {
    this.done = true;
    const parts = String(value).trim().split(":").map((x) => parseInt(x, 10) || 0);
    let sec = 0;
    if (parts.length === 3) sec = parts[0] * 3600 + parts[1] * 60 + parts[2];
    else if (parts.length === 2) sec = parts[0] * 60 + parts[1];
    else sec = parts[0];
    this.close();
    this.resolve(sec);
  }
  onClose() { this.contentEl.empty(); if (!this.done) this.resolve(null); }
}

/* ============================ B站 扫码登录 ============================ */

class BiliLoginModal extends Modal {
  constructor(app, plugin, onChange) {
    super(app);
    this.plugin = plugin;
    this.onChange = onChange;
    this.cancelled = false;
    this.pollTimer = null;
  }

  onOpen() {
    this.contentEl.addClass("vns-login-modal");
    if (this.plugin.hasBiliLogin()) this.showAccount();
    else this.startLogin().catch((e) => this.showError(e));
  }

  onClose() {
    this.cancelled = true;
    if (this.pollTimer) clearTimeout(this.pollTimer);
    this.contentEl.empty();
  }

  showAccount() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h3", { text: "B站账号" });
    const user = this.plugin.settings.biliUser || {};
    contentEl.createDiv({ cls: "vns-login-account", text: user.uname ? `已登录：${user.uname}` : "已保存登录状态" });
    contentEl.createDiv({ cls: "vns-setting-note", text: "重新加载视频后，将使用你的账号可用清晰度。大会员专属画质仍需对应账号权限。" });
    const row = contentEl.createDiv({ cls: "vns-login-actions" });
    row.createEl("button", { text: "重新扫码", cls: "mod-cta" }).addEventListener("click", () => this.startLogin().catch((e) => this.showError(e)));
    row.createEl("button", { text: "退出登录" }).addEventListener("click", async () => {
      await this.plugin.clearBiliLogin();
      if (this.onChange) await this.onChange(false);
      this.close();
      new Notice("已退出 B站登录");
    });
  }

  showError(error) {
    this.contentEl.empty();
    this.contentEl.createEl("h3", { text: "B站登录失败" });
    this.contentEl.createDiv({ cls: "vns-login-error", text: error && error.message ? error.message : String(error) });
    this.contentEl.createEl("button", { text: "重试", cls: "mod-cta" }).addEventListener("click", () => this.startLogin().catch((e) => this.showError(e)));
  }

  async startLogin() {
    this.cancelled = false;
    if (this.pollTimer) clearTimeout(this.pollTimer);
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h3", { text: "扫码登录 B站" });
    const status = contentEl.createDiv({ cls: "vns-login-status", text: "正在获取二维码…" });
    const qrBox = contentEl.createDiv({ cls: "vns-login-qr" });
    contentEl.createDiv({ cls: "vns-setting-note", text: "使用哔哩哔哩手机 App 扫码并确认。Cookie 仅保存在本机插件 data.json。" });

    const data = await this.plugin.requestJson("https://passport.bilibili.com/x/passport-login/web/qrcode/generate", this.plugin.biliHeaders());
    if (data.code !== 0 || !data.data || !data.data.qrcode_key) throw new Error(data.message || "二维码生成失败");
    this.qrcodeKey = data.data.qrcode_key;
    if (!qrGenerator) throw new Error("二维码组件缺失：请确认 qrcode.js 与 main.js 位于同一目录");
    const qr = qrGenerator(0, "M");
    qr.addData(data.data.url);
    qr.make();
    const svg = new DOMParser().parseFromString(qr.createSvgTag(4, 12), "image/svg+xml").documentElement;
    qrBox.empty();
    qrBox.appendChild(svg);
    status.setText("等待扫码…");
    this.poll(status).catch((e) => this.showError(e));
  }

  /** 从任意 URL 里抽取 B站 登录 Cookie（兼容三种返回形态） */
  parseBiliCookies(rawUrl, setCookieHeaders) {
    const cookies = {};
    const names = ["SESSDATA", "bili_jct", "DedeUserID", "DedeUserID__ckMd5", "sid"];
    // 形态 1：登录成功时 data.url 形如 https://.../?SESSDATA=xxx&DedeUserID=yyy&...
    try {
      const u = new URL(String(rawUrl || ""));
      for (const name of names) {
        const v = u.searchParams.get(name);
        if (v) cookies[name] = v;
      }
      // 有些版本把 Cookie 放在 hash 片段里：#SESSDATA=...
      const hash = (u.hash || "").replace(/^#/, "");
      if (hash.includes("SESSDATA")) {
        for (const pair of hash.split("&")) {
          const [k, v] = pair.split("=");
          if (k && names.includes(decodeURIComponent(k)) && v) cookies[decodeURIComponent(k)] = decodeURIComponent(v);
        }
      }
    } catch (e) { /* url 可能为空 */ }
    // 形态 2：Set-Cookie 响应头
    for (const line of setCookieHeaders || []) {
      const first = String(line).split(";")[0];
      const eq = first.indexOf("=");
      if (eq <= 0) continue;
      const k = first.slice(0, eq).trim();
      const v = first.slice(eq + 1);
      if (names.includes(k) && v) cookies[k] = v;
    }
    // 形态 3：rawUrl 本身是 cookieless 的登录态（data.url 为空但 refresh_token 存在）时无法补 SESSDATA
    return cookies;
  }

  async poll(statusEl) {
    if (this.cancelled) return;
    const pollUrl = `https://passport.bilibili.com/x/passport-login/web/qrcode/poll?qrcode_key=${encodeURIComponent(this.qrcodeKey)}`;
    const res = await requestUrl({ url: pollUrl, method: "GET", headers: this.plugin.biliHeaders(), throw: false });
    let data;
    try { data = res.json || JSON.parse(res.text || "{}"); } catch (e) { data = {}; }
    if (this.cancelled) return;
    const code = data.data ? data.data.code : data.code;
    if (code === 0) {
      statusEl.setText("登录成功，正在写入 Cookie…");
      const rawUrl = (data.data && data.data.url) || "";
      // Set-Cookie 可能出现在 requestUrl 的 header 里，也可能被 Electron 自动吸收；两种都收
      let setCookies = [];
      try {
        const hdrs = res.headers || {};
        const sc = hdrs["set-cookie"] || hdrs["Set-Cookie"];
        if (sc) setCookies = Array.isArray(sc) ? sc : [sc];
      } catch (e) { /* ignore */ }
      const cookies = this.parseBiliCookies(rawUrl, setCookies);
      if (!cookies.SESSDATA) {
        // 最后一次机会：登录态可能已被 Electron 会话吸收，直接问会话要
        try {
          const electron = require("electron");
          const session = electron.remote && electron.remote.session ? electron.remote.session.defaultSession : (electron.session && electron.session.defaultSession);
          if (session) {
            const all = await session.cookies.get({ domain: ".bilibili.com" });
            for (const c of all) {
              if (["SESSDATA", "bili_jct", "DedeUserID", "DedeUserID__ckMd5", "sid"].includes(c.name)) cookies[c.name] = c.value;
            }
          }
        } catch (e) { /* ignore */ }
      }
      if (!cookies.SESSDATA) {
        throw new Error("登录已成功，但没能从返回里取到 SESSDATA。请点「重试」再扫一次；若反复失败，把这条报错发我。");
      }
      this.plugin.settings.biliCookies = cookies;
      this.plugin.settings.biliUser = { mid: cookies.DedeUserID || "" };
      await this.plugin.saveSettings();
      await this.plugin.applyBiliCookies();
      await this.plugin.refreshBiliUser();
      if (this.onChange) await this.onChange(true);
      new Notice("B站登录成功，正在重载视频以应用账号画质", 6000);
      this.close();
      return;
    }
    if (code === 86038) { this.showError(new Error("二维码已过期，请重新获取")); return; }
    if (code === 86090) statusEl.setText("已扫码，请在手机上确认登录…");
    else if (code === 86101) statusEl.setText("等待扫码…");
    else {
      this.showError(new Error((data.data && data.data.message) || data.message || `登录状态异常（${code}）`));
      return;
    }
    this.pollTimer = setTimeout(() => this.poll(statusEl).catch((e) => this.showError(e)), 2000);
  }
}

/* ============================ 抖音抓取小窗 ============================ */

/**
 * 打开抖音播放页，等 <video> 真正拿到播放地址后关窗返回。
 * 顺带把 Cookie 写回设置，供 yt-dlp / 转录使用。
 */
class DouyinCaptureModal extends Modal {
  constructor(app, plugin, link, opts = {}) {
    super(app);
    this.plugin = plugin;
    this.link = link;
    this.opts = opts;
    this.done = false;
    this.timer = null;
    this.hardTimer = null;
    this.wv = null;
    this.onDone = null;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.addClass("vns-douyin-modal");
    contentEl.createEl("h3", { text: "抖音：抓取播放地址" });
    this.statusEl = contentEl.createDiv({
      cls: "vns-setting-note",
      text: "正在打开抖音页面…首次可能需要登录 / 点一下播放键，抓到地址会自动关窗。",
    });
    const actionRow = contentEl.createDiv({ cls: "vns-login-actions" });
    actionRow.createEl("button", { text: "跳过，直接生成笔记" }).addEventListener("click", () => this.finish(null));
    const frame = contentEl.createDiv({ cls: "vns-douyin-frame" });

    const url = this.link.kind === "douyin" && this.link.id
      ? `https://www.douyin.com/video/${this.link.id}`
      : this.link.url;
    try {
      this.wv = this.plugin.createDouyinWebview(frame, url);
    } catch (e) {
      this.statusEl.setText(`内嵌浏览器不可用：${e.message}`);
      return;
    }

    this.wv.addEventListener("dom-ready", () => this.afterReady());
    this.wv.addEventListener("did-fail-load", (ev) => {
      if (ev && (ev.errorCode === -3 || ev.errorCode === 0)) return;
      this.statusEl.setText(`页面加载失败：${ev && ev.errorDescription}`);
    });
    this.wv.style.height = "72vh";
    this.hardTimer = setTimeout(() => this.finish(null, "超时75秒没抓到播放地址"), 80000);
  }

  afterReady() {
    const wv = this.wv;
    // 尽力自动播放（抖音可能要求一次用户手势）
    wv.executeJavaScript("(() => { const v = document.querySelector('video'); if (v) v.play().catch(() => {}); return 1; })()", true).catch(() => {});
    const started = Date.now();
    const poll = async () => {
      if (this.done || !this.wv) return;
      try {
        await wv.executeJavaScript("(() => { const v = document.querySelector('video'); if (v && v.paused) { v.muted = true; const p = v.play(); if (p && p.catch) p.catch(() => {}); } return 1; })()", true);
      } catch (e) { /* ignore */ }
      if (this.opts.cookieOnly && Date.now() - started > 4000) {
        const cookie = await this.plugin.harvestDouyinCookies(wv).catch(() => "");
        this.finish({ cookie, mediaUrl: "" });
        return;
      }
      const st = await this.plugin.readDouyinState(wv);
      const media = st ? this.plugin.pickDouyinMedia(st) : "";
      const picked = media && /^https?:/i.test(media) ? media : "";
      this.dbg = {
        elapsedMs: Date.now() - started,
        href: (st && st.href) || "",
        title: (st && st.title) || "",
        hasVideo: !!(st && st.hasVideo),
        paused: !!(st && st.paused),
        src: (st && st.src) || "",
        dur: (st && st.dur) || 0,
        routerPlay: (st && st.routerPlay) || [],
        res: ((st && st.mediaUrls) || []).slice(-4),
        picked,
        notFound: !!(st && st.notFound),
      };
      if (st && st.notFound) {
        this.finish(null, "抖音说这个视频不存在（可能已删除/仅自己可见）");
        return;
      }
      if (picked) {
        const cookie = await this.plugin.harvestDouyinCookies(wv).catch(() => "");
        this.plugin.settings.douyinCookieAt = Date.now();
        this.finish({
          mediaUrl: picked,
          duration: Math.round(st.dur || 0),
          title: (st.desc || "").trim() || (st.title || "").replace(/\s*-\s*抖音.*$/, "").trim(),
          desc: (st.desc || "").trim(),
          author: (st.author || "").trim(),
          stats: [
            st.likes ? `点赞 ${st.likes}` : "",
            st.comments ? `评论 ${st.comments}` : "",
            st.collects ? `收藏 ${st.collects}` : "",
            st.shares ? `分享 ${st.shares}` : "",
          ].filter(Boolean).join(" ｜ "),
          cookie,
        });
        return;
      }
      if (Date.now() - started > 75000) {
        const cookie = await this.plugin.harvestDouyinCookies(wv).catch(() => "");
        this.finish({ mediaUrl: "", cookie }, "75秒没抓到播放地址（试试在窗口里登录/点播放后再来）");
        return;
      }
      this.statusEl.setText(st && st.hasVideo
        ? "检测到播放器，等它开始播放…（点一下窗口里的播放键会更快）"
        : "页面已加载，正在等待播放器…");
      this.timer = setTimeout(poll, 900);
    };
    this.timer = setTimeout(poll, 700);
  }

  finish(result, tip) {
    if (this.done) return;
    this.done = true;
    try {
      const fsx = require("fs");
      fsx.writeFileSync(require("path").join(require("os").tmpdir(), "vns-douyin-capture.json"),
        JSON.stringify({
          at: new Date().toISOString(),
          url: (this.link && this.link.url) || "",
          tip: tip || "",
          mediaUrl: (result && result.mediaUrl) || "",
          dbg: this.dbg || null,
        }, null, 2));
    } catch (e) { console.debug("[vns] 抓取调试写入失败", e.message); }
    if (this.timer) clearTimeout(this.timer);
    if (this.hardTimer) clearTimeout(this.hardTimer);
    const cb = this.onDone;
    this.onDone = null;
    this.close();
    if (cb) cb(result);
    if (tip) new Notice(`抖音抓取：${tip}`, 6000);
  }

  onClose() {
    if (this.timer) clearTimeout(this.timer);
    if (this.hardTimer) clearTimeout(this.hardTimer);
    if (this.wv) { try { this.wv.remove(); } catch (e) { /* ignore */ } this.wv = null; }
    this.contentEl.empty();
    if (!this.done) {
      this.done = true;
      const cb = this.onDone;
      this.onDone = null;
      if (cb) cb(null);
    }
  }
}

/* ============================ 主插件 ============================ */

class VideoNoteStudio extends Plugin {
  async onload() {
    await this.loadSettings();
    this.noteIndex = new Map();
    this.pendingUrl = null;

    this.registerView(VIEW_TYPE_PLAYER, (leaf) => new VideoPlayerView(leaf, this));
    this.registerObsidianProtocolHandler("vns", (params) => this.handleVnsProtocol(params));
    this.setupBiliReferer();
    this.bridgePath = this.resolveBridgePath();
    this.ensureBridgeFile();
    this.registerSourceClick();
    this.registerEvent(this.app.workspace.on("file-open", (file) => {
      this.maybeAutoOpenPlayer(file).catch((e) => console.debug("[vns] 自动打开播放器失败", e));
    }));
    this.addRibbonIcon("play-circle", "打开视频播放器", () => this.openPlayer());    this.addSettingTab(new VnsSettingTab(this.app, this));
    this.addRibbonIcon("bookmark", "同步抖音收藏到笔记", () => { this.recordHabit("sync-douyin-fav"); this.openFavSync(); });

    const cmd = (id, name, fn) => this.addCommand({ id, name, callback: () => { this.recordHabit(id); Promise.resolve(fn()).catch((e) => this.fail(e)); } });

    cmd("open-player", "打开视频播放器窗口", () => this.openPlayer());
    cmd("import-link", "贴链接生成笔记", () => this.importLinkPrompt());
    cmd("import-clipboard", "从剪贴板链接生成笔记", async () => {
      const text = await navigator.clipboard.readText();
      await this.importLink(text.trim());
    });
    cmd("add-timestamp", "给当前笔记打时间戳", () => this.timestampToNote());
    cmd("summarize-note", "用模型总结当前笔记", () => this.summarizeCurrentNote());
    cmd("translate-note", "把当前笔记翻译成中文", () => this.translateCurrentNote());
    cmd("ocr-image", "图片 OCR 转笔记", () => this.ocrPrompt());
    cmd("make-canvas", "把当前笔记拆成 Canvas 白板", () => this.canvasFromActiveNote());
    cmd("distill-book", "拆书：书籍转章节笔记", () => this.distillBookPrompt());
    cmd("enrich-clippings", "补全 Clippings 里的视频剪藏", () => this.enrichClippings());
    cmd("write-habits", "生成使用习惯笔记", () => this.writeHabitNote());
    cmd("sync-douyin-fav", "抖音：同步收藏到笔记", () => this.openFavSync());
    cmd("douyin-cookie", "抖音：打开页面抓取 Cookie", async () => {
      const r = await this.probeDouyinCookies();
      new Notice(r && r.cookie ? `抖音 Cookie 已更新（${this.douyinCookieInfo()}）` : "没抓到 Cookie，试试在窗口里登录一次", 8000);
    });

    this.app.workspace.onLayoutReady(() => {
      this.rebuildIndex();
      this.maybeAutoSyncFavorites();
    });
    this.registerInterval(window.setInterval(() => this.maybeTimerSync(), 60 * 1000));
    this.registerEvent(this.app.vault.on("rename", (f, old) => this.reindexFile(f, old)));
  }

  onunload() {
    // 官方指南：不要在 onunload 里 detachLeavesOfType——用户更新插件时 leaf 会被原地重建
    if (this._habitTimer) clearTimeout(this._habitTimer);
  }

  resolveBridgePath() {
    try {
      const nodePath = require("path");
      const fs = require("fs");
      const adapter = this.app.vault.adapter;
      const base = adapter && typeof adapter.getBasePath === "function" ? adapter.getBasePath() : null;
      const cfg = this.app.vault.configDir || ".obsidian";
      const candidates = [];
      if (base) candidates.push(nodePath.join(base, cfg, "plugins", this.manifest.id, "asr_bridge.py"));
      if (this.manifest.dir) {
        if (base && !nodePath.isAbsolute(this.manifest.dir)) {
          candidates.push(nodePath.join(base, this.manifest.dir, "asr_bridge.py"));
        }
        candidates.push(nodePath.resolve(this.manifest.dir, "asr_bridge.py"));
      }
      for (const c of candidates) {
        try { if (fs.existsSync(c)) return c; } catch (e) { /* ignore */ }
      }
      console.debug("[vns] 没找到 asr_bridge.py，候选路径：", candidates);
      return candidates[0] || "";
    } catch (e) {
      console.debug("[vns] 解析 bridge 路径失败", e);
      return "";
    }
  }

  /**
   * 用内嵌的 asr_bridge.py 覆盖磁盘上的旧副本。
   * 社区插件更新只会下载 main.js/manifest/styles，不会带 asr_bridge.py，
   * 旧副本留在插件目录里就会和新 main.js 传的参数对不上（例如 --media-url）。
   */
  ensureBridgeFile() {
    const p = this.bridgePath;
    if (!p) return "";
    try {
      const fs = require("fs");
      const nodePath = require("path");
      const embedded = Buffer.from(ASR_BRIDGE_B64, "base64").toString("utf8");
      let cur = "";
      try { cur = fs.readFileSync(p, "utf8"); } catch (e) { cur = ""; }
      if (cur !== embedded) {
        fs.mkdirSync(nodePath.dirname(p), { recursive: true });
        fs.writeFileSync(p, embedded, "utf8");
        console.debug("[vns] asr_bridge.py 已同步到内嵌版本（旧副本被替换）");
      }
      return p;
    } catch (e) {
      console.debug("[vns] 同步 asr_bridge.py 失败", e);
      return "";
    }
  }

  pythonCandidates() {
    const list = [this.settings.pythonPath, "python", "python3", "py"];
    try {
      const fs = require("fs");
      const nodePath = require("path");
      const roots = [
        process.env.LOCALAPPDATA && nodePath.join(process.env.LOCALAPPDATA, "Programs", "Python"),
        "C:\\Python312",
        "C:\\Python311",
        "C:\\Program Files\\Python312",
      ].filter(Boolean);
      for (const root of roots) {
        if (!fs.existsSync(root)) continue;
        for (const d of fs.readdirSync(root)) {
          const exe = nodePath.join(root, d, "python.exe");
          try { if (fs.existsSync(exe)) list.push(exe); } catch (e) { /* ignore */ }
        }
      }
    } catch (e) { /* ignore */ }
    return [...new Set(list.filter(Boolean))];
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    await this.applyBiliCookies();
  }
  async saveSettings() { await this.saveData(this.settings); }

  fail(e) {
    console.error("[video-note-studio]", e);
    new Notice(`出错了：${e && e.message ? e.message : e}`, 8000);
  }

  /* ---------- 播放器 ---------- */
  async openPlayer(silent) {
    let leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE_PLAYER)[0];
    if (!leaf) {
      const mode = this.settings.playerSplit === "window" ? "window" : this.settings.playerSplit === "tab" ? "tab" : "split";
      leaf = this.app.workspace.getLeaf(mode);
      await leaf.setViewState({ type: VIEW_TYPE_PLAYER, active: !silent });
    }
    if (!silent) this.app.workspace.revealLeaf(leaf);
    return leaf;
  }

  /** 打开笔记时自动加载对应视频（笔记绑定播放器） */
  async maybeAutoOpenPlayer(file) {
    if (!this.settings.autoOpenPlayerOnNote) return;
    if (!(file instanceof TFile) || file.extension !== "md") return;
    let fm = null;
    try {
      const cache = this.app.metadataCache.getFileCache(file);
      fm = cache && cache.frontmatter;
    } catch (e) { /* ignore */ }
    const raw = fm && (fm.source || fm.Source || fm.url);
    const url = raw ? this.resolveVideoUrl(String(raw)) : null;
    if (!url) return;
    // 同一篇笔记 + 同一视频只自动加载一次，避免来回切标签页时反复重载
    if (this._autoOpenedFor === file.path && this._autoOpenedUrl === url) return;
    this._autoOpenedFor = file.path;
    this._autoOpenedUrl = url;
    await this.playVideoUrl(url, { silent: true });
  }

  /** 设置页「测试直链」：把 B站 解析链路每步结果都报出来 */
  async diagnoseBiliStream() {
    const lines = [];
    lines.push(`Referer 注入: ${this._biliRefererOk ? "✅ 已安装" : "❌ 未安装"}`);
    lines.push(`B站 登录: ${this.hasBiliLogin() ? "✅ 已登录" : "未登录（游客最高 480P 左右）"}`);
    const testLink = { kind: "bilibili", id: "BV1nZpd6nEsF", page: 1, url: "https://www.bilibili.com/video/BV1nZpd6nEsF" };
    try {
      const view = await this.requestJson(`https://api.bilibili.com/x/web-interface/view?bvid=${testLink.id}`, this.biliHeaders());
      lines.push(`view API: code=${view.code} cid=${view.data ? view.data.cid : "?"}`);
      if (view.code !== 0) { lines.push(`  msg=${view.message || ""}`); return lines.join("\n"); }
      const s = await this.resolveBiliStream(testLink);
      lines.push(`playurl: mode=${s.mode} current=${s.current}`);
      lines.push(`可选画质: ${s.qualities.map((q) => `${q.label}${q.available === false ? "(不可用)" : ""}`).join(" / ")}`);
      if (s.mode === "dash") {
        const pick = this.pickDashStream(s, s.current);
        lines.push(`选中流: qn=${pick.qn} ${pick.width}x${pick.height}`);
        lines.push(`video host=${pick.videoUrl ? new URL(pick.videoUrl).host : "无"}`);
        lines.push(`audio host=${pick.audioUrl ? new URL(pick.audioUrl).host : "无"}`);
      }
    } catch (e) {
      lines.push(`❌ 失败: ${e.message}`);
    }
    return lines.join("\n");
  }

  async testBridge() {
    if (!cp) return "当前环境起不了外部进程（仅桌面版）";
    for (const bin of this.pythonCandidates()) {
      try {
        const out = await runProcess(bin,
          ["-c", "import sys,faster_whisper,opencc;print('ok python',sys.version.split()[0],'faster-whisper',faster_whisper.__version__,'OpenCC 就绪')"],
          require("os").tmpdir(), 60000);
        return `${bin} 可用 → ${out.trim()}`;
      } catch (e) {
        if (!/ENOENT|not found|不是内部或外部命令/i.test(e.message)) return `${bin} 不可用 → ${e.message}`;
      }
    }
    return "找不到可用的 Python，请把「Python 路径」填成 python.exe 的完整路径";
  }

  /** 点击笔记属性里的 source（视频链接）→ 用插件播放器打开 */
  registerSourceClick() {
    // 阅读视图 / 属性面板里的链接点击
    this.registerDomEvent(document, "click", (ev) => {
      const a = ev.target && ev.target.closest ? ev.target.closest("a") : null;
      if (!a) return;
      const href = a.getAttribute("href") || a.getAttribute("data-href") || "";
      if (!href) return;
      const url = this.resolveVideoUrl(href);
      if (!url) return;
      ev.preventDefault();
      ev.stopPropagation();
      this.playVideoUrl(url);
    }, true);

    // 属性面板（Properties）里 source 字段的原始文本值，点击也可播
    this.registerDomEvent(document, "click", (ev) => {
      const el = ev.target;
      if (!el || !el.closest) return;
      const prop = el.closest(".metadata-property");
      if (!prop) return;
      const key = prop.getAttribute("data-property-key") || "";
      if (key !== "source") return;
      const valueEl = prop.querySelector(".metadata-property-value a, .metadata-property-value");
      const raw = valueEl ? (valueEl.getAttribute("href") || valueEl.textContent || "") : "";
      const url = this.resolveVideoUrl(raw);
      if (!url) return;
      ev.preventDefault();
      ev.stopPropagation();
      this.playVideoUrl(url);
    }, true);
  }

  /** 播放器下方面板的数据（概要 + 时间戳）存放在隐藏目录 .vns/panels */
  panelCacheDir() { return ".vns/panels"; }

  panelKey(link) {
    const raw = (link && (link.id || link.url)) || "x";
    return String(raw).replace(/[^0-9A-Za-z_-]/g, "_").slice(0, 100);
  }

  async savePanelData(link, data) {
    try {
      const adapter = this.app.vault.adapter;
      const dir = this.panelCacheDir();
      if (!(await adapter.exists(dir))) await adapter.mkdir(dir);
      const path = `${dir}/${this.panelKey(link)}.json`;
      await adapter.write(path, JSON.stringify(Object.assign({ url: link.url, updated: Date.now() }, data)));
    } catch (e) { console.debug("[vns] 面板数据保存失败", e.message); }
  }

  async loadPanelData(link) {
    try {
      const adapter = this.app.vault.adapter;
      const path = `${this.panelCacheDir()}/${this.panelKey(link)}.json`;
      if (!(await adapter.exists(path))) return null;
      return JSON.parse(await adapter.read(path));
    } catch (e) { return null; }
  }

  /** 从任意 href/文本里还原出视频 URL（兼容 obsidian://、相对链接、裸文本） */
  resolveVideoUrl(raw) {
    let s = String(raw || "").trim();
    if (!s) return null;
    if (s.startsWith("obsidian://")) {
      try {
        const u = new URL(s);
        const target = u.searchParams.get("url") || u.searchParams.get("u") || "";
        s = decodeURIComponent(target);
      } catch (e) { return null; }
    }
    if (/^(bilibili\.com|www\.bilibili\.com|player\.bilibili)/i.test(s)) s = `https://${s}`;
    if (!/^https?:\/\//i.test(s)) return null;
    const kind = detectLink(s).kind;
    if (!["bilibili", "youtube", "douyin", "direct", "short"].includes(kind)) return null;
    return s;
  }

  /** 用播放器 leaf 打开并播放给定链接 */
  async playVideoUrl(url, opts) {
    opts = opts || {};
    const leaf = await this.openPlayer(opts.silent);
    const view = leaf && leaf.view;
    if (!(view instanceof VideoPlayerView)) return;
    if (view.link && view.link.url === url && view.videoEl) return;
    if (view.urlInput) view.urlInput.value = url;
    await view.load(url);
  }

  async handleVnsProtocol(params) {
    if (params && params.cmd === "probe") { await this.runProbe(params.u); return; }
    if (params && params.cmd === "selftest") { await this.runSelfTest(); return; }
    if (params && params.cmd === "favsync") { this.openFavSync({ limit: parseInt(params.l || "0", 10) || undefined, mode: params.mode || undefined }); return; }
    if (params && params.cmd === "fav") { await this.runDouyinFavDiag(params); return; }
    if (params && params.cmd === "diag") { await this.runDouyinDiag(); return; }
    if (params && params.cmd === "import" && params.u) { await this.importLink(params.u); return; }
    const u = (params && params.u) || "";
    const t = Math.max(0, parseInt((params && params.t) || "0", 10) || 0);
    if (!u) return;
    this.recordHabit("jump-timestamp");
    const leaf = await this.openPlayer();
    const view = leaf && leaf.view;
    if (!(view instanceof VideoPlayerView)) return;
    if (!view.link || view.link.url !== u) {
      if (view.urlInput) view.urlInput.value = u;
      await view.load(u, t);
    } else {
      view.seek(t);
    }
    if (t > 0) new Notice(`已跳转到 ${fmtTime(t)}`, 2000);
  }

  /** 抖音收藏诊断：验证 window.use('webSignUrl') 出签 + listcollection 接口 */
  async runDouyinFavDiag(params) {
    const out = { at: new Date().toISOString(), codeVersion: "fav-diag-r1" };
    const modal = new Modal(this.app);
    const wv = document.createElement("webview");
    wv.setAttribute("partition", DOUYIN_PARTITION);
    wv.setAttribute("src", "https://www.douyin.com/user/self?showTab=favorite_collection");
    wv.style.width = "100%";
    wv.style.height = "100%";
    modal.onOpen = () => {
      modal.contentEl.addClass("vns-douyin-modal");
      modal.contentEl.createEl("h3", { text: "抖音收藏诊断" });
      const box = modal.contentEl.createDiv({ cls: "vns-douyin-frame" });
      box.appendChild(wv);
    };
    modal.onClose = () => { try { wv.remove(); } catch (e) { /* ignore */ } modal.contentEl.empty(); };
    modal.open();
    const script = `(async () => {
  const out = {};
  try {
    out.href = location.href;
    out.useType = typeof window.use;
    const fn = window.use && window.use('webSignUrl');
    out.signType = typeof fn;
    let webid = '';
    try { const s = JSON.parse(localStorage.getItem('SysInfo') || '{}'); if (s && s.webid) webid = String(s.webid); } catch (e) {}
    if (!webid) { try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.indexOf('__tea_cache_tokens_') === 0) { const v = JSON.parse(localStorage.getItem(k) || '{}'); if (v && v.user_unique_id) { webid = String(v.user_unique_id); break; } } } } catch (e) {} }
    out.webid = webid;
    const ck = (document.cookie || '').split('; ');
    const uifid = ((ck.filter((x) => x.indexOf('UIFID=') === 0)[0] || '').slice(6));
    out.uifidLen = uifid.length;
    const p = {
      device_platform: 'webapp', aid: '6383', channel: 'channel_pc_web',
      publish_video_strategy_type: '2', pc_client_type: '1', pc_libra_divert: 'Windows',
      update_version_code: '170400', support_h265: '1', support_dash: '1',
      version_code: '170400', version_name: '17.4.0', cookie_enabled: 'true',
      screen_width: String(window.screen.width), screen_height: String(window.screen.height),
      browser_language: navigator.language || 'zh-CN', browser_platform: navigator.platform || 'Win32',
      browser_name: 'Chrome', browser_version: '131.0.0.0', browser_online: String(navigator.onLine),
      engine_name: 'Blink', engine_version: '131.0.0.0', os_name: 'Windows', os_version: '10',
      cpu_core_num: String(navigator.hardwareConcurrency || 8), device_memory: String(navigator.deviceMemory || 8),
      platform: 'PC', downlink: '10', effective_type: '4g', round_trip_time: '200'
    };
    if (webid) p.webid = webid;
    if (uifid) p.uifid = uifid;
    const qs = Object.keys(p).map((k) => encodeURIComponent(k) + '=' + encodeURIComponent(p[k])).join('&');
    const base = 'https://www.douyin.com/aweme/v1/web/aweme/listcollection/?' + qs;
    out.baseLen = base.length;
    out.res = (performance.getEntriesByType('resource') || []).map((e) => e.name).filter((u) => u.indexOf('/aweme/v1/web/') >= 0).slice(0, 6);
    let signed = base;
    if (typeof fn === 'function') {
      try { const o = await fn(base); out.signOutType = typeof o; out.signOut = JSON.stringify(o).slice(0, 300); signed = (o && o.url) || (typeof o === 'string' ? o : base); }
      catch (e) { out.signErr = String((e && e.message) || e); }
    }
    out.signed = (typeof signed === 'string') && signed.indexOf('a_bogus=') > 0;
    out.signedHead = String(signed).slice(-160);
    const candidates = [
      'https://www.douyin.com/aweme/v1/web/aweme/listcollection/',
      'https://www.douyin.com/aweme/v1/web/aweme/listcollection',
      'https://www.douyin.com/aweme/v1/web/favorite/collect/list/'
    ];
    out.tries = [];
    for (const c of candidates) {
      const suffix = String(signed).indexOf('?') > 0 ? String(signed).slice(String(signed).indexOf('?')) : '';
      const u = c + suffix;
      try {
        const r = await fetch(u, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'x-secsdk-csrf-token': 'DOWNGRADE' }, body: 'count=10&cursor=0' });
        const t = await r.text();
        const row = { ep: c, status: r.status, len: t.length, head: t.slice(0, 200) };
        try { const j = JSON.parse(t); const list = j.aweme_list || []; row.items = list.length; row.more = j.has_more; row.cursor = j.cursor; } catch (e) { row.parseErr = String((e && e.message) || e); }
        out.tries.push(row);
      } catch (e) { out.tries.push({ ep: c, err: String((e && e.message) || e) }); }
    }
  } catch (e) { out.fatal = String((e && e.message) || e); }
  return JSON.stringify(out);
})()`;
    setTimeout(async () => {
      try {
        out.raw = await wv.executeJavaScript(script, true);
      } catch (e) { out.error = String((e && e.message) || e); }
      try {
        const fsx = require("fs");
        fsx.writeFileSync(require("path").join(require("os").tmpdir(), "vns-fav-diag.json"), JSON.stringify(out, null, 2));
      } catch (e) { console.debug("[vns] 收藏诊断写入失败", e.message); }
      try { modal.close(); } catch (e) { /* ignore */ }
    }, 14000);
  }

  async runDouyinDiag(params) {
    const out = { at: new Date().toISOString(), codeVersion: "diag-r3", steps: [] };
    const target = (params && params.u) || "https://www.douyin.com/video/7298145681699622182";
    const modal = new Modal(this.app);
    const wv = document.createElement("webview");
    wv.setAttribute("partition", DOUYIN_PARTITION);
    wv.setAttribute("src", target);
    out.target = target;
    wv.style.width = "100%";
    wv.style.height = "100%";
    modal.onOpen = () => {
      modal.contentEl.addClass("vns-douyin-modal");
      modal.contentEl.createEl("h3", { text: "抖音诊断（结果写到 _meta/vns-douyin-diag.json）" });
      const box = modal.contentEl.createDiv({ cls: "vns-douyin-frame" });
      box.appendChild(wv);
    };
    modal.onClose = () => { try { wv.remove(); } catch (e) { /* ignore */ } modal.contentEl.empty(); };
    modal.open();

    const js = (code) => wv.executeJavaScript(code, true);
    const dump = async () => {
      try {
        out.webviewTag = typeof wv.executeJavaScript;
        out.getWebContentsType = typeof wv.getWebContents;
        out.getURL = typeof wv.getURL === "function" ? wv.getURL() : "(no getURL)";
        out.href = await js("location.href");
        out.readyState = await js("document.readyState");
        out.title = await js("document.title");
        out.text = String(await js("((document.body && document.body.innerText) || '').slice(0, 500)"));
        out.videos = await js("document.querySelectorAll('video').length");
        out.vsrc = await js("(() => { const v = document.querySelector('video'); return v ? (v.currentSrc || v.src || '') : ''; })()");
        out.hasRouterData = await js("!!window._ROUTER_DATA");
        out.routerPlay = await js(`(() => {
          try {
            const rd = window._ROUTER_DATA;
            if (!rd) return [];
            const found = (JSON.stringify(rd).match(/https?:\\/\\/[^" ]+/g) || []);
            return found.filter((u) => /(douyinvod|bytecdn|byteoversea|aweme\\.com)/i.test(u)).slice(0, 6);
          } catch (e) { return ["ERR " + e.message]; }
        })()`);
        out.resMedia = await js(`(performance.getEntriesByType('resource') || []).map((e) => e.name)
          .filter((u) => /(douyinvod|bytecdn|byteoversea|\\.mp4|\\.m4s|\\.m3u8)/i.test(u)).slice(-10)`);
        out.globals = await js(`Object.keys(window).filter((k) => /aweme|douyin|render|router|initial|pace|__P|_SSR/i.test(k)).slice(0, 40)`);
        out.htmlLen = await js("(document.documentElement.innerHTML || '').length");
        out.htmlHits = await js(`(() => {
          const h = document.documentElement.innerHTML || '';
          const m = h.match(/https?:[^"' ]*(?:douyinvod|bytecdn|byteoversea)[^"' ]*/g) || [];
          return m.slice(0, 5);
        })()`);
        out.playApi = await js(`(async () => {
          try {
            const id = (location.href.match(/video\\/(\\d+)/) || [])[1] || '';
            const r = await fetch('https://www.douyin.com/aweme/v1/web/aweme/detail/?device_platform=webapp&aid=6383&channel=channel_pc_web&aweme_id=' + id, { credentials: 'include' });
            const t = await r.text();
            const hit = (t.match(/https?:[^"\\\\ ]*(?:douyinvod|bytecdn)[^"\\\\ ]*/g) || []);
            return { status: r.status, len: t.length, head: t.slice(0, 160), media: hit.slice(0, 3) };
          } catch (e) { return { error: String((e && e.message) || e) }; }
        })()`);
        out.docCookie = String(await js("document.cookie") || "").slice(0, 300);
        if (typeof wv.getWebContents === "function") {
          const wc = wv.getWebContents();
          out.wcOk = !!wc;
          if (wc && wc.session && wc.session.cookies) {
            const list = await wc.session.cookies.get({});
            out.cookieCount = (list || []).length;
            out.cookies = (list || []).filter((c) => String(c.domain).includes("douyin"))
              .map((c) => `${c.domain}|${c.name}`);
          }
        }
      } catch (e) {
        out.error = String((e && e.message) || e);
      }
      try {
        const fsx = require("fs");
        fsx.writeFileSync(require("path").join(require("os").tmpdir(), "vns-douyin-diag.json"),
          JSON.stringify(out, null, 2));
      } catch (e) { console.debug("[vns] 诊断写入失败", e.message); }
    };
    setTimeout(() => { dump(); }, 9000);
    setTimeout(() => { try { modal.close(); } catch (e) { /* ignore */ } }, 40000);
  }

  /** 抓某个抖音页面自己发的接口（用于发现收藏夹/喜欢/作品端点） */
  async runProbe(url) {
    const out = { at: new Date().toISOString(), codeVersion: "probe-r1", target: url };
    const modal = new Modal(this.app);
    const wv = document.createElement("webview");
    wv.setAttribute("partition", DOUYIN_PARTITION);
    wv.setAttribute("src", url);
    wv.style.width = "100%";
    wv.style.height = "100%";
    modal.onOpen = () => {
      modal.contentEl.addClass("vns-douyin-modal");
      modal.contentEl.createEl("h3", { text: "接口探测" });
      const box = modal.contentEl.createDiv({ cls: "vns-douyin-frame" });
      box.appendChild(wv);
    };
    modal.onClose = () => { try { wv.remove(); } catch (e) { /* ignore */ } modal.contentEl.empty(); };
    modal.open();
    setTimeout(async () => {
      try {
        const js = `(() => {
          const res = (performance.getEntriesByType('resource') || []).map((e) => e.name)
            .filter((u) => u.indexOf('/aweme/v1/web/') >= 0)
            .map((u) => u.split('&a_bogus')[0].split('&msToken')[0]);
          const uniq = [];
          for (const u of res) { const k = u.split('?')[0]; if (!uniq.some((x) => x.split('?')[0] === k)) uniq.push(u); }
          return JSON.stringify({
            href: location.href,
            title: document.title,
            uniq: uniq.slice(0, 12),
            body: ((document.body && document.body.innerText) || '').slice(0, 300)
          });
        })()`;
        out.raw = await wv.executeJavaScript(js, true);
      } catch (e) { out.error = String((e && e.message) || e); }
      try {
        require("fs").writeFileSync(require("path").join(require("os").tmpdir(), "vns-probe.json"), JSON.stringify(out, null, 2));
      } catch (e) { /* ignore */ }
      try { modal.close(); } catch (e) { /* ignore */ }
    }, 14000);
  }

  /** 自检：伪渲染设置页 + 检查关键方法存在，结果写临时文件 */
  async runSelfTest() {
    const out = { at: new Date().toISOString(), codeVersion: "selftest-r1" };
    try {
      const tab = new VnsSettingTab(this.app, this);
      const el = document.createElement("div");
      tab.containerEl = el;
      tab.display();
      out.settingsNodes = el.childElementCount;
      out.settingsHtmlLen = el.innerHTML.length;
    } catch (e) { out.settingsError = String((e && e.message) || e); out.settingsStack = String(e && e.stack || "").slice(0, 600); }
    try {
      const idx = await this.loadFavIndex();
      out.favIndexCount = Object.keys(idx).length;
      out.hasFetchFav = typeof this.fetchDouyinFavPage === "function";
      out.hasImportFav = typeof this.importFavItem === "function";
      out.hasModal = typeof DouyinFavSyncModal === "function";
    } catch (e) { out.favError = String((e && e.message) || e); }
    try {
      const fsx = require("fs");
      fsx.writeFileSync(require("path").join(require("os").tmpdir(), "vns-selftest.json"), JSON.stringify(out, null, 2));
    } catch (e) { /* ignore */ }
  }

  /* ---------- 抖音收藏同步 ---------- */
  favIndexPath() { return ".vns/douyin-favorites.json"; }

  async loadFavIndex() {
    try {
      const adapter = this.app.vault.adapter;
      if (!(await adapter.exists(this.favIndexPath()))) return {};
      const data = JSON.parse((await adapter.read(this.favIndexPath())) || "{}");
      return data && typeof data === "object" ? data : {};
    } catch (e) { return {}; }
  }

  async saveFavIndex(index) {
    try {
      const adapter = this.app.vault.adapter;
      if (!(await adapter.exists(".vns"))) await adapter.mkdir(".vns");
      await adapter.write(this.favIndexPath(), JSON.stringify(index));
    } catch (e) { console.debug("[vns] 收藏索引保存失败", e.message); }
  }

  openFavSync(opts) { new DouyinFavSyncModal(this.app, this, opts || {}).open(); }

  /** 常驻定时同步：设置分钟数 > 0 时，按间隔自动跑（每分钟检查一次） */
  maybeTimerSync() {
    const min = Number(this.settings.favEveryMin) || 0;
    if (min <= 0 || this._favSyncing) return;
    const last = Number(this.settings.favLastSync) || 0;
    if (Date.now() - last < min * 60 * 1000) return;
    this._favSyncing = true;
    try { this.openFavSync(); } catch (e) { this._favSyncing = false; }
  }

  /** 启动时按需自动同步一次（默认关闭；距上次超过 12 小时才跑） */
  maybeAutoSyncFavorites() {
    if (!this.settings.favAutoSync) return;
    const last = Number(this.settings.favLastSync) || 0;
    if (Date.now() - last < 12 * 3600 * 1000) return;
    setTimeout(() => {
      try { this.openFavSync(); } catch (e) { console.debug("[vns] 自动同步收藏失败", e.message); }
    }, 8000);
  }

  /** 等页面里的 window.use('webSignUrl') 可用（抖音内部出签接口） */
  async waitFavSigner(wv, timeoutMs) {
    const deadline = Date.now() + (timeoutMs || 45000);
    while (Date.now() < deadline) {
      try {
        const ok = await wv.executeJavaScript("typeof (window.use && window.use('webSignUrl')) === 'function'", true);
        if (ok) return true;
      } catch (e) { /* 页面还没就绪 */ }
      await new Promise((r) => setTimeout(r, 1000));
    }
    return false;
  }

  /** 在收藏页上下文里出一页签名请求（webSignUrl + listcollection） */
  async fetchDouyinFavPage(wv, cursor, count) {
    const n = Math.max(1, Math.min(20, parseInt(count, 10) || 20));
    const c = Math.max(0, parseInt(cursor, 10) || 0);
    const script = `(async () => {
  const out = { ok: false };
  try {
    const fn = window.use && window.use('webSignUrl');
    if (typeof fn !== 'function') { out.err = 'webSignUrl 不可用（页面可能没登录或未加载完）'; return JSON.stringify(out); }
    let webid = '';
    try { const s = JSON.parse(localStorage.getItem('SysInfo') || '{}'); if (s && s.webid) webid = String(s.webid); } catch (e) {}
    if (!webid) { try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.indexOf('__tea_cache_tokens_') === 0) { const v = JSON.parse(localStorage.getItem(k) || '{}'); if (v && v.user_unique_id) { webid = String(v.user_unique_id); break; } } } } catch (e) {} }
    const ck = (document.cookie || '').split('; ');
    const uifid = ((ck.filter((x) => x.indexOf('UIFID=') === 0)[0] || '').slice(6));
    const p = {
      device_platform: 'webapp', aid: '6383', channel: 'channel_pc_web',
      publish_video_strategy_type: '2', pc_client_type: '1', pc_libra_divert: 'Windows',
      update_version_code: '170400', support_h265: '1', support_dash: '1',
      version_code: '170400', version_name: '17.4.0', cookie_enabled: 'true',
      screen_width: String(window.screen.width), screen_height: String(window.screen.height),
      browser_language: navigator.language || 'zh-CN', browser_platform: navigator.platform || 'Win32',
      browser_name: 'Chrome', browser_version: '131.0.0.0', browser_online: String(navigator.onLine),
      engine_name: 'Blink', engine_version: '131.0.0.0', os_name: 'Windows', os_version: '10',
      cpu_core_num: String(navigator.hardwareConcurrency || 8), device_memory: String(navigator.deviceMemory || 8),
      platform: 'PC', downlink: '10', effective_type: '4g', round_trip_time: '200'
    };
    if (webid) p.webid = webid;
    if (uifid) p.uifid = uifid;
    const qs = Object.keys(p).map((k) => encodeURIComponent(k) + '=' + encodeURIComponent(p[k])).join('&');
    const base = 'https://www.douyin.com/aweme/v1/web/aweme/listcollection?' + qs;
    let url = base;
    try { const o = await fn(base); url = (o && o.url) || base; } catch (e) { out.signErr = String((e && e.message) || e); }
    const r = await fetch(url, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'x-secsdk-csrf-token': 'DOWNGRADE' }, body: 'count=${n}&cursor=${c}' });
    const t = await r.text();
    out.status = r.status;
    if (r.status === 403 || String(t).trim() === 'blocked') { out.blocked = true; return JSON.stringify(out); }
    let j = null;
    try { j = JSON.parse(t); } catch (e) { out.err = '返回不是 JSON（status ' + r.status + '）：' + String(t).slice(0, 120); return JSON.stringify(out); }
    const list = j.aweme_list || [];
    out.hasMore = !!j.has_more;
    out.cursor = Number(j.cursor || 0);
    out.total = j.total || 0;
    out.items = list.map((it) => {
      const v = it.video || {};
      const cover = (((v.cover || {}).url_list) || [])[0] || ((((v.origin_cover || {}).url_list) || [])[0]) || '';
      const play = (((v.play_addr || {}).url_list) || [])[0] || '';
      const br = ((v.bit_rate || [])[0] || {});
      const playHi = ((((br.play_addr || {}).url_list) || [])[0]) || play;
      const imgs = (it.images || []).map((im) => (((im.url_list) || [])[0] || '')).filter(Boolean);
      const dur = Number(v.duration || 0);
      return {
        id: String(it.aweme_id || ''),
        desc: String(it.desc || ''),
        author: String(((it.author || {}).nickname) || ''),
        time: Number(it.create_time || 0),
        dur: Math.round(dur > 1000 ? dur / 1000 : dur),
        cover: cover,
        play: playHi,
        imgs: imgs,
        type: (imgs.length ? 'image' : 'video'),
        digg: Number(((it.statistics || {}).digg_count) || 0),
        comment: Number(((it.statistics || {}).comment_count) || 0),
        collect: Number(((it.statistics || {}).collect_count) || 0)
      };
    });
    out.ok = true;
  } catch (e) { out.err = String((e && e.message) || e); }
  return JSON.stringify(out);
})()`;
    let raw = "";
    try { raw = await wv.executeJavaScript(script, true); } catch (e) { return { ok: false, err: String((e && e.message) || e) }; }
    try { return JSON.parse(raw); } catch (e) { return { ok: false, err: `返回无法解析：${String(raw).slice(0, 120)}` }; }
  }

  /** 收藏条目标题：取文案首行（去掉 @ 和话题），没有就用作者+ID */
  favTitle(item) {
    const first = String(item.desc || "").split("\n").map((s) => s.trim()).filter(Boolean)[0] || "";
    let clean = first
      .replace(/#[^\s#]+/g, "")
      .replace(/@[^\s@]+/g, "")
      .replace(/\[[^\]]*R\]/g, "")
      .replace(/\s+/g, " ")
      .trim();
    // 取第一个句读之前，避免标题是半句话
    const m = clean.match(/^(.{6,40}?)[。！？!?，,｜|；;]/);
    if (m && m[1].trim().length >= 6) clean = m[1].trim();
    clean = clean.replace(/[。，、；：,;:]+$/, "").trim();
    if (clean.length > 36) clean = clean.slice(0, 36).replace(/[^\u4e00-\u9fa5A-Za-z0-9]+$/, "");
    if (clean.length >= 4) return clean;
    const day = item.time ? new Date(item.time * 1000).toISOString().slice(0, 10) : "";
    return `${item.author || "抖音"}${day ? ` ${day}` : ""}`.trim();
  }

  favTags(item) {
    const found = String(item.desc || "").match(/#[^\s#]+/g) || [];
    const out = [];
    for (const raw of found) {
      const t = raw.slice(1).replace(/[^\p{L}\p{N}_-]/gu, "").slice(0, 20);
      if (t.length >= 2 && !out.includes(t)) out.push(t);
      if (out.length >= 8) break;
    }
    return out;
  }

  favNum(n) {
    const v = Number(n) || 0;
    if (v >= 100000000) return `${(v / 100000000).toFixed(1)}亿`;
    if (v >= 10000) return `${(v / 10000).toFixed(1)}万`;
    return String(v);
  }

  /** 下载远程二进制到 vault（已存在则跳过） */
  async ensureFavBinary(url, relPath, referer) {
    try {
      const adapter = this.app.vault.adapter;
      if (await adapter.exists(relPath)) return true;
      const res = await requestUrl({
        url, method: "GET", throw: false,
        headers: {
          Referer: referer || "https://www.douyin.com/",
          "User-Agent": VNS_UA_MOBILE,
        },
      });
      const buf = res.arrayBuffer;
      if (res.status >= 400 || !buf || !buf.byteLength) return false;
      const dir = relPath.slice(0, relPath.lastIndexOf("/"));
      if (dir && !(await adapter.exists(dir))) await adapter.mkdir(dir);
      if (typeof adapter.writeBinary === "function") await adapter.writeBinary(relPath, buf);
      else await this.app.vault.createBinary(relPath, buf);
      return true;
    } catch (e) {
      console.debug("[vns] 收藏附件下载失败", url, e.message);
      return false;
    }
  }

  buildFavNote(item, extra) {
    const url = `https://www.douyin.com/video/${item.id}`;
    const fm = ["---", "type: douyin", `content_type: ${item.type}`, `douyin_id: "${item.id}"`,
      `author: "${String(item.author || "").replace(/"/g, "'")}"`, `source: ${url}`];
    if (item.time) {
      const d = new Date(item.time * 1000);
      fm.push(`create_time: "${d.toISOString().slice(0, 16).replace("T", " ")}"`);
    }
    fm.push("favorite: true", `synced: ${new Date().toISOString().slice(0, 10)}`, "tags:", "  - douyin", "  - douyin-favorite");
    for (const t of this.favTags(item)) fm.push(`  - ${t}`);
    fm.push("---", "");

    const body = [`# ${extra.title}`, ""];
    if (extra.videoRel) body.push(`![[${extra.videoRel}]]`, "");
    else if (extra.coverRel) body.push(`![[${extra.coverRel}]]`, "");
    else if (item.cover) body.push(`![封面](${item.cover})`, "");

    const meta = [];
    if (item.author) meta.push(`作者 @${item.author}`);
    if (item.time) meta.push(`发布于 ${new Date(item.time * 1000).toLocaleDateString()}`);
    if (item.dur) meta.push(`时长 ${fmtTime(item.dur)}`);
    const stat = [];
    if (item.digg) stat.push(`👍 ${this.favNum(item.digg)}`);
    if (item.comment) stat.push(`💬 ${this.favNum(item.comment)}`);
    if (item.collect) stat.push(`⭐ ${this.favNum(item.collect)}`);
    if (stat.length) meta.push(stat.join(" "));
    body.push(`> [!note] 抖音收藏 ｜ ${meta.join(" ｜ ")}`, "");

    if (item.desc) body.push("## 文案", "", String(item.desc).trim().slice(0, 4000), "");
    if (extra.summary) {
      const sp = splitSummary(extra.summary);
      if (sp.points) body.push("## 要点", "", sp.points.trim(), "");
    }
    if (extra.imageRels && extra.imageRels.length) {
      body.push("## 配图", "", ...extra.imageRels.map((r) => `![[${r}]]`), "");
    }
    if (extra.transcript && extra.transcript.length) {
      body.push(`> [!quote]- 视频逐字稿（${extra.transcript.length} 段，点击时间戳跳转播放）`);
      for (const [t, s] of extra.transcript) {
        body.push(`> - [${fmtTime(t)}](obsidian://vns?u=${encodeURIComponent(url)}&t=${Math.floor(t)}) ${s}`);
      }
      body.push("");
    }
    return fm.join("\n") + body.join("\n");
  }

  /** 单条收藏 → 一篇笔记 */
  async importFavItem(item, mode, opts) {
    opts = opts || {};
    const folder = this.settings.favFolder || "抖音收藏";
    const attachRoot = this.settings.favAttachFolder || `${folder}/附件`;
    const relBase = `${attachRoot}/${item.id}`;
    const title = this.favTitle(item);
    const url = `https://www.douyin.com/video/${item.id}`;
    const ref = "https://www.douyin.com/";
    await ensureFolder(this.app, folder);

    const coverRel = item.cover && await this.ensureFavBinary(item.cover, `${relBase}/cover.jpg`, ref) ? `${relBase}/cover.jpg` : "";
    const imageRels = [];
    if (item.type === "image") {
      for (let i = 0; i < item.imgs.length; i += 1) {
        const rel = `${relBase}/${String(i + 1).padStart(2, "0")}.jpg`;
        if (await this.ensureFavBinary(item.imgs[i], rel, ref)) imageRels.push(rel);
      }
    }

    let transcript = [];
    let videoRel = "";
    if (mode === "heavy" && item.type === "video") {
      const link = { kind: "douyin", id: item.id, url, mediaUrl: item.play || "", duration: item.dur };
      if (item.play) {
        const rel = `${relBase}/video.mp4`;
        if (await this.ensureFavBinary(item.play, rel, ref)) videoRel = rel;
      }
      if (opts.transcribe && this.settings.asrEnabled) {
        transcript = await this.localTranscript(link);
      }
    }

    let summary = "";
    const bodyText = transcript.length ? transcript.map((x) => x[1]).join("\n") : String(item.desc || "");
    if (opts.summarize && this.hasLlm() && bodyText.trim().length > 40) {
      try { summary = await this.summarize({ title, author: item.author }, bodyText); } catch (e) { console.debug("[vns] 收藏摘要失败", e.message); }
    }

    const md = this.buildFavNote(item, { title, coverRel, videoRel, imageRels, transcript, summary });
    const path = uniquePath(this.app, folder, `${slug(item.author || "抖音")}-${slug(title)}`);
    await this.app.vault.create(path, md);
    return path;
  }

  pickLocalVideo(cb) { new LocalVideoSuggest(this.app, cb).open(); }

  askTime(current, duration) {
    return new Promise((resolve) => new TimeModal(this.app, current, duration, resolve).open());
  }

  async insertIntoActiveNote(line, link) {
    let file = this.app.workspace.getActiveFile();
    if (!file || file.extension !== "md") {
      const path = link && this.noteIndex.get(link.url);
      if (path) file = this.app.vault.getAbstractFileByPath(path);
    }
    if (!file) {
      if (!link) throw new Error("没有可用笔记，先生成一篇");
      file = await this.importLink(link.url);
    }
    const add = (data) => {
      const marker = "## 时间戳";
      if (data.includes(marker)) return `${data.trimEnd()}\n${line}\n`;
      return `${data.trimEnd()}\n\n${marker}\n\n${line}\n`;
    };
    if (this.app.vault.process) await this.app.vault.process(file, add);
    else {
      const cur = await this.app.vault.read(file);
      await this.app.vault.modify(file, add(cur));
    }
  }

  async timestampToNote() {
    const leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE_PLAYER)[0];
    if (leaf && leaf.view instanceof VideoPlayerView) return leaf.view.captureTimestamp();
    const sec = await this.askTime(0, 0);
    if (sec === null) return;
    await this.insertIntoActiveNote(`- [${fmtTime(sec)}]() `, null);
  }

  /* ---------- 元数据 / 转录 ---------- */
  hasLlm() { return !!(this.settings.magpieEnabled || this.settings.llmApiKey); }

  async fetchMagpieModels() {
    const base = (this.settings.magpieBaseUrl || "http://127.0.0.1:3425/v1").replace(/\/+$/, "");
    const res = await requestUrl({ url: `${base}/models`, method: "GET", throw: false });
    if (res.status >= 400) throw new Error(`HTTP ${res.status}`);
    const data = res.json || JSON.parse(res.text || "{}");
    return (data.data || []).map((m) => m.id).filter(Boolean).sort();
  }

  /** B站 CDN 校验 Referer，必须给直链请求补上，否则 403。
   *  注意：不能设 Origin——设了会让 cors 校验把请求变成需要预检的跨域请求而失败。 */
  setupBiliReferer() {
    try {
      const electron = require("electron");
      const session = electron.remote && electron.remote.session
        ? electron.remote.session.defaultSession
        : (electron.session && electron.session.defaultSession);
      if (!session || !session.webRequest) {
        console.debug("[vns] 没有 webRequest 权限，B站 直链可能 403");
        this._biliRefererOk = false;
        return;
      }
      const filter = { urls: ["*://*.bilivideo.com/*", "*://*.bilivideo.cn/*", "*://*.mcdn.bilivideo.com/*", "*://*.szbdyd.com/*"] };
      session.webRequest.onBeforeSendHeaders(filter, (details, callback) => {
        const h = details.requestHeaders || {};
        h["Referer"] = "https://www.bilibili.com/";
        delete h["Origin"];
        callback({ requestHeaders: h });
      });
      this._biliRefererOk = true;
      console.debug("[vns] B站 Referer 注入已安装");
    } catch (e) {
      this._biliRefererOk = false;
      console.debug("[vns] 安装 B站 Referer 失败", e.message);
    }
  }

  hasBiliLogin() { return !!(this.settings.biliCookies && this.settings.biliCookies.SESSDATA); }

  biliCookieHeader() {
    return Object.entries(this.settings.biliCookies || {}).map(([k, v]) => `${k}=${v}`).join("; ");
  }

  biliHeaders() {
    const headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130 Safari/537.36",
      Referer: "https://www.bilibili.com/",
    };
    const cookie = this.biliCookieHeader();
    if (cookie) headers.Cookie = cookie;
    return headers;
  }

  /* ---------- 抖音 & 分享短链 ---------- */

  douyinCookieHeader() { return String(this.settings.douyinCookieHeader || "").trim(); }

  douyinCookieInfo() {
    const header = this.douyinCookieHeader();
    if (!header) return "还没有 Cookie（打开一次抖音播放页会自动抓取）";
    const at = this.settings.douyinCookieAt ? new Date(this.settings.douyinCookieAt) : null;
    return `${Math.max(1, Math.round(header.length / 1024))} KB${at ? `，抓取于 ${at.toLocaleString()}` : ""}`;
  }

  /**
   * 解析 v.douyin.com / b23.tv 这类分享短链。
   * 抖音短链只有手机 UA 才停在 iesdouyin 分享落地页，页面里有 canonical / itemId。
   */
  async resolveShortLink(rawUrl) {
    // 防御到底：调用方可能直接把整段分享文案塞进来，先抠一遍 URL
    const key = extractUrl(String(rawUrl || "").trim());
    if (!key || !/^https?:\/\//i.test(key)) throw new Error("没认出可解析的链接，试试直接粘贴视频页链接");
    this.shortCache = this.shortCache || new Map();
    if (this.shortCache.has(key)) return this.shortCache.get(key);

    const res = await requestUrl({
      url: key, method: "GET", throw: false,
      headers: {
        "User-Agent": VNS_UA_MOBILE,
        "Accept-Language": "zh-CN,zh;q=0.9",
        Referer: "https://www.douyin.com/",
      },
    });
    const html = res.text || "";
    const pick = (re) => { const m = html.match(re); return m ? decodeEnt(m[1]).trim() : ""; };
    const canonical = pick(/<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["']/i) ||
      pick(/<meta[^>]+property=["']og:url["'][^>]*content=["']([^"']+)["']/i);

    let resolved = null;
    for (const candidate of [canonical, key]) {
      if (!candidate) continue;
      const l = detectLink(candidate);
      if (l.kind !== "short") { resolved = l; break; }
    }
    if (!resolved) {
      const idm = html.match(/\/video\/(\d{15,})/) || html.match(/"itemId"\s*:\s*"?(\d{15,})/) ||
        html.match(/\/share\/video\/(\d{15,})/);
      const bv = html.match(/bilibili\.com\/video\/(BV[0-9A-Za-z]{10})/);
      if (idm) resolved = { kind: "douyin", id: idm[1], url: `https://www.douyin.com/video/${idm[1]}` };
      else if (bv) resolved = { kind: "bilibili", id: bv[1], page: 1, url: `https://www.bilibili.com/video/${bv[1]}` };
    }
    if (!resolved) throw new Error("短链解析失败：可能已过期，直接粘贴视频页链接试试");

    resolved.url = resolved.url || key;
    resolved.shortUrl = key;
    this.shortCache.set(key, resolved);
    return resolved;
  }

  /** 统一入口：任意链接 → 识别结果（短链会自动展开） */
  async resolveLink(raw) {
    const url = String(raw || "").trim();
    const link = detectLink(url);
    link.url = url;
    if (link.kind !== "short") return link;
    const r = await this.resolveShortLink(url);
    return r;
  }

  /** yt-dlp 取元数据（抖音需要新鲜 Cookie） */
  async ytDlpJson(url, extraArgs = []) {
    if (!cp || !this.settings.ytDlpPath) throw new Error("没有可用的 yt-dlp");
    const fs = require("fs");
    const os = require("os");
    const pathApi = require("path");
    const tmp = fs.mkdtempSync(pathApi.join(os.tmpdir(), "vns-meta-"));
    try {
      const args = ["--dump-single-json", "--skip-download", "--no-warnings", "--no-playlist",
        ...extraArgs, url];
      const out = await runProcess(this.settings.ytDlpPath, args, tmp, 90 * 1000);
      const line = String(out).trim().split(/\r?\n/).filter(Boolean).pop() || "{}";
      return JSON.parse(line);
    } finally {
      try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) { /* ignore */ }
    }
  }

  /** 抖音元数据：yt-dlp + Cookie 为主，分享页 HTML 兜底 */
  async douyinMeta(link, fast = false) {
    const meta = { title: link.url, author: "", published: "", duration: 0, description: "", extra: "抖音" };
    const cookie = this.douyinCookieHeader();
    let ytErr = "";
    if (!fast) try {
      const j = await this.ytDlpJson(link.url, cookie ? ["--add-header", `Cookie: ${cookie}`] : []);
      meta.title = j.title || j.fulltitle || meta.title;
      meta.author = j.uploader || j.channel || j.creator || "";
      meta.duration = Math.round(j.duration || 0);
      meta.description = j.description || "";
      meta.thumb = j.thumbnail || "";
      meta.published = j.upload_date ? String(j.upload_date).replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3") : "";
      meta.stats = [j.like_count ? `点赞 ${j.like_count}` : "", j.comment_count ? `评论 ${j.comment_count}` : ""]
        .filter(Boolean).join(" ｜ ");
      if (!String(meta.title).trim() || /^https?:/i.test(meta.title)) throw new Error("yt-dlp 没给出标题");
      return meta;
    } catch (e) {
      ytErr = e.message;
      console.debug("[vns] 抖音 yt-dlp 元数据失败", ytErr);
    }
    try {
      const res = await requestUrl({
        url: link.url, method: "GET", throw: false,
        headers: { "User-Agent": VNS_UA_MOBILE, Referer: "https://www.douyin.com/" },
      });
      const html = res.text || "";
      const pick = (re) => { const m = html.match(re); return m ? decodeEnt(m[1]).trim() : ""; };
      meta.title = pick(/<meta[^>]+property=["']og:title["'][^>]*content=["']([^"']+)/i) ||
        pick(/<title[^>]*>([\s\S]*?)<\/title>/i) || meta.title;
      meta.description = pick(/<meta[^>]+(?:property|name)=["'](?:og:)?description["'][^>]*content=["']([^"']+)/i);
      meta.html = html;
    } catch (e) {
      meta.error = ytErr ? `${ytErr}；${e.message}` : e.message;
    }
    return meta;
  }

  /** 在任意容器里挂一个复用抖音分区的 webview */
  createDouyinWebview(container, url, kind) {
    const wv = document.createElement("webview");
    wv.setAttribute("partition", kind && kind !== "douyin" ? "persist:vns-web" : DOUYIN_PARTITION);
    wv.setAttribute("src", url);
    wv.setAttribute("webpreferences", "backgroundThrottling=false");
    wv.className = "vns-webview";
    wv.style.width = "100%";
    wv.style.height = "100%";
    container.appendChild(wv);
    return wv;
  }

  /** 读取 webview 里 <video> 的状态 + 页面上的标题/作者/互动数（抖音页面是 JS 渲染，DOM 里才有真数据） */
  async readDouyinState(wv) {
    if (!wv || typeof wv.executeJavaScript !== "function") return {};
    const js = `(() => {
      const v = (() => { const vids = Array.from(document.querySelectorAll('video')).filter((x) => x.videoWidth > 0 && x.videoHeight > 0).sort((a, b) => (b.videoWidth * b.videoHeight) - (a.videoWidth * a.videoHeight)); return vids[0] || document.querySelector('video'); })();
      const pick = (sel) => { const el = document.querySelector(sel); return el ? (el.innerText || el.textContent || '').trim() : ''; };
      const bodyText = ((document.body && document.body.innerText) || '').slice(0, 4000);
      return JSON.stringify({
        hasVideo: !!v,
        src: v ? (v.currentSrc || v.src || '') : '',
        t: v ? v.currentTime : 0,
        dur: v && isFinite(v.duration) ? v.duration : 0,
        vw: v ? v.videoWidth : 0,
        vh: v ? v.videoHeight : 0,
        paused: v ? v.paused : true,
        title: document.title || '',
        href: location.href || '',
        notFound: /视频不存在|作品已删除|内容不可见|已下架/.test(bodyText),
        desc: pick('[data-e2e="video-desc"]') || pick('h1'),
        author: pick('[data-e2e="user-info"] a') || pick('[data-e2e="video-author"]') || pick('.author-name'),
        likes: pick('[data-e2e="like-count"]'),
        comments: pick('[data-e2e="comment-count"]'),
        collects: pick('[data-e2e="collect-count"]'),
        shares: pick('[data-e2e="share-count"]'),
        hasRouterData: !!window._ROUTER_DATA,
        mediaUrls: (performance.getEntriesByType('resource') || [])
          .map((e) => e.name)
          .filter((u) => /(\\.mp4|\\.m4s|\\.m3u8|douyinvod|bytecdn|byteoversea)/i.test(u))
          .slice(-12),
        routerPlay: (() => {
          try {
            const rd = window._ROUTER_DATA;
            if (!rd) return [];
            const found = (JSON.stringify(rd).match(/https?:\\/\\/[^" ]+/g) || []);
            const seen = Object.create(null);
            return found
              .filter((u) => /(douyinvod|bytecdn|byteoversea|aweme\\.com)/i.test(u))
              .filter((u) => /(\\.mp4|\\.m4s|\\.m3u8|media-video|media-audio)/i.test(u))
              .filter((u) => (seen[u] ? false : (seen[u] = 1)))
              .slice(0, 10);
          } catch (e) { return []; }
        })()
      });
    })()`;
    try {
      const raw = await wv.executeJavaScript(js, true);
      return JSON.parse(raw || "{}");
    } catch (e) {
      return {};
    }
  }

  /**
   * 从页面状态里挑一个能下载的媒体 URL。
   * 抖音网页播放器走 MSE，<video>.currentSrc 是 blob:，只能从资源时序里找真地址。
   */
  pickDouyinMedia(st) {
    const urls = (st && st.mediaUrls) || [];
    const byExt = (re) => urls.filter((u) => re.test(u)).pop() || "";
    const m3u8 = byExt(/\.m3u8(\?|$)/i);
    if (m3u8) return m3u8;
    const mp4 = byExt(/\.mp4(\?|$)/i);
    if (mp4) return mp4;
    const cdn = byExt(/douyinvod|bytecdn|byteoversea/i);
    if (cdn) return cdn;
    // 兜底：页面自带的 _ROUTER_DATA（play_addr.url_list）里就是直链，视频没自动播放也能拿到
    const router = (st && st.routerPlay) || [];
    const pick = (re) => router.filter((u) => re.test(u)).pop() || "";
    const rAudio = pick(/media-audio/i);
    if (rAudio) return rAudio;
    const rVideo = pick(/media-video|\.mp4(\?|$)|\.m4s(\?|$)/i);
    if (rVideo) return rVideo;
    const rAny = router.length ? router[router.length - 1] : "";
    if (rAny) return rAny;
    const src = (st && st.src) || "";
    return /^https?:/i.test(src) ? src : "";
  }

  /** 从 webview 会话里抓抖音 Cookie（yt-dlp / 直链下载用） */
  async harvestDouyinCookies(wv) {
    let list = null;
    try {
      const wc = wv && typeof wv.getWebContents === "function" ? wv.getWebContents() : null;
      if (wc && wc.session && wc.session.cookies) {
        const all = await wc.session.cookies.get({});
        list = (all || []).filter((c) => String(c.domain || "").includes("douyin"));
      }
    } catch (e) {
      console.debug("[vns] webview Cookie 读取失败", e.message);
    }
    if (!list || !list.length) {
      try {
        const raw = await wv.executeJavaScript("document.cookie", true);
        list = String(raw || "").split(";").map((s) => {
          const i = s.indexOf("=");
          return i > 0 ? { name: s.slice(0, i).trim(), value: s.slice(i + 1).trim() } : null;
        }).filter(Boolean);
      } catch (e) { /* ignore */ }
    }
    const header = (list || []).map((c) => `${c.name}=${c.value}`).join("; ");
    if (header) {
      this.settings.douyinCookieHeader = header;
      this.settings.douyinCookieAt = Date.now();
      await this.saveSettings();
      console.debug("[vns] 抖音 Cookie 已抓取", list.length, "条");
    }
    return header;
  }

  /** 用独立小窗打开抖音页面，抓播放地址 + Cookie（生成笔记时用） */
  async captureDouyinMedia(link, opts = {}) {
    if (this.settings.douyinWebview === false) return null;
    const modal = new DouyinCaptureModal(this.app, this, link, opts);
    return new Promise((resolve) => { modal.onDone = resolve; modal.open(); });
  }

  /** 只为拿 Cookie：打开抖音首页，抓完即关 */
  async probeDouyinCookies(url) {
    if (this.settings.douyinWebview === false) this.settings.douyinWebview = true;
    return this.captureDouyinMedia(
      { kind: "douyin", id: "", url: url || "https://www.douyin.com/" },
      { cookieOnly: true },
    );
  }

  async applyBiliCookies() {    const cookies = this.settings.biliCookies || {};
    if (!Object.keys(cookies).length) return false;
    try {
      const electron = require("electron");
      const session = electron.remote && electron.remote.session ? electron.remote.session.defaultSession : electron.session && electron.session.defaultSession;
      if (!session) return false;
      for (const [name, value] of Object.entries(cookies)) {
        await session.cookies.set({
          url: "https://www.bilibili.com/", domain: ".bilibili.com", path: "/",
          name, value: String(value), secure: true,
        });
      }
      return true;
    } catch (e) {
      console.debug("[vns] 写入 B站 Cookie 失败", e);
      return false;
    }
  }

  async refreshBiliUser() {
    if (!this.hasBiliLogin()) return null;
    try {
      const res = await this.requestJson("https://api.bilibili.com/x/web-interface/nav", this.biliHeaders());
      if (res.code === 0 && res.data && res.data.isLogin) {
        this.settings.biliUser = { mid: res.data.mid || "", uname: res.data.uname || "" };
        await this.saveSettings();
        return this.settings.biliUser;
      }
    } catch (e) { console.debug("[vns] 获取 B站用户失败", e); }
    return null;
  }

  async clearBiliLogin() {
    const cookies = this.settings.biliCookies || {};
    try {
      const electron = require("electron");
      const session = electron.remote && electron.remote.session ? electron.remote.session.defaultSession : electron.session && electron.session.defaultSession;
      if (session) {
        for (const name of Object.keys(cookies)) {
          try { await session.cookies.remove("https://www.bilibili.com/", name); } catch (e) { /* ignore */ }
        }
      }
    } catch (e) { /* ignore */ }
    this.settings.biliCookies = {};
    this.settings.biliUser = null;
    await this.saveSettings();
  }

  async requestJson(url, headers) {
    const res = await requestUrl({ url, method: "GET", throw: false, headers: headers || {} });
    const text = res.text || (res.json ? JSON.stringify(res.json) : "");
    if (res.status >= 400) throw new Error(`HTTP ${res.status} @ ${url.slice(0, 80)}: ${String(text).slice(0, 160)}`);
    try {
      return res.json || JSON.parse(text || "{}");
    } catch (e) {
      throw new Error(`返回不是 JSON @ ${url.slice(0, 80)}: ${String(text).slice(0, 160)}`);
    }
  }

  async requestHtml(url) {
    const res = await requestUrl({
      url, method: "GET", throw: false,
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Obsidian", Referer: url },
    });
    if (res.status >= 400) throw new Error(`HTTP ${res.status}`);
    return res.text || "";
  }

  async fetchMeta(link) {
    const meta = { title: link.url, author: "", published: "", duration: 0, description: "", extra: "" };
    try {
      if (link.kind === "bilibili") {
        const j = await this.requestJson(`https://api.bilibili.com/x/web-interface/view?bvid=${link.id}`, this.biliHeaders());
        const d = j.data || {};
        meta.title = d.title || meta.title;
        meta.author = (d.owner && d.owner.name) || "";
        meta.duration = d.duration || 0;
        meta.published = d.pubdate ? new Date(d.pubdate * 1000).toISOString().slice(0, 10) : "";
        meta.description = d.desc || "";
        if (link.page > 1 && d.pages && d.pages[link.page - 1]) {
          meta.extra = d.pages[link.page - 1].part || "";
        }
        if (d.pages && d.pages.length > 1) {
          meta.pages = d.pages.map((p, i) => `${i + 1}. ${p.part || `P${i + 1}`}`);
        }
        if (d.stat) {
          meta.stats = `播放 ${d.stat.view || 0} ｜ 点赞 ${d.stat.like || 0} ｜ 弹幕 ${d.stat.danmaku || 0}`;
        }
        if (Array.isArray(d.tags) && d.tags.length) meta.tagList = d.tags;
        return meta;
      }
      if (link.kind === "youtube") {
        const j = await this.requestJson(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(link.url)}`);
        meta.title = j.title || meta.title;
        meta.author = j.author_name || "";
        return meta;
      }
      if (link.kind === "douyin") return await this.douyinMeta(link, true);
      if (link.kind === "netdisk" || link.kind === "weixin" || link.kind === "web" || link.kind === "short") {
        const html = await this.requestHtml(link.url);
        const pick = (re) => { const m = html.match(re); return m ? decodeEnt(m[1]).trim() : ""; };
        meta.title = pick(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i) ||
          pick(/<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)/i) ||
          pick(/<title[^>]*>([\s\S]*?)<\/title>/i) || meta.title;
        meta.author = pick(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)/i);
        meta.description = pick(/<meta[^>]+(?:property|name)=["'](?:og:)?description["'][^>]+content=["']([^"']+)/i);
        meta.html = html;
        const code = html.match(/(?:提取码|密码|pwd|password)\s*[:：=]?\s*([0-9a-zA-Z]{4})/i);
        if (code) meta.extra = `提取码：${code[1]}`;
      }
    } catch (e) {
      meta.error = e.message;
    }
    return meta;
  }

  /* ---------- B站 直链播放 ---------- */

  /**
   * 通过 playurl API 解析 B站 视频直链。
   * 优先 DASH（画质最高，音视频分离），拿不到时退回 durl 单文件 MP4。
   */
  async resolveBiliStream(link, preferQn) {
    const cid = link.cid || await (async () => {
      const j = await this.requestJson(`https://api.bilibili.com/x/web-interface/view?bvid=${link.id}`, this.biliHeaders());
      return j && j.data ? j.data.cid : null;
    })();
    if (!cid) throw new Error("拿不到 cid，无法解析直链");
    link.cid = cid;

    const qn = preferQn || 80;
    const buildUrl = (fnval, useQn) =>
      `https://api.bilibili.com/x/player/playurl?bvid=${link.id}&cid=${cid}`
      + `${link.page > 1 ? `&page=${link.page}` : ""}`
      + `&qn=${useQn}&fnval=${fnval}&fourk=1&high_quality=1`;

    let dash = null;
    try {
      const j = await this.requestJson(buildUrl(4048, qn), this.biliHeaders());
      if (j.code === 0 && j.data && j.data.dash && Array.isArray(j.data.dash.video) && j.data.dash.video.length) {
        dash = j.data;
      }
    } catch (e) { console.debug("[vns] DASH 解析失败", e.message); }

    if (dash) {
      // 优先 avc1（兼容性最好，Electron 能直接解），同画质下取码率最高的
      const byQn = new Map();
      for (const v of dash.video) {
        const prev = byQn.get(v.id);
        const isAvc = /^avc1/i.test(v.codecs || "");
        const prevAvc = prev && /^avc1/i.test(prev.codecs || "");
        if (!prev || (isAvc && !prevAvc) || (isAvc === prevAvc && (v.bandwidth || 0) > (prev.bandwidth || 0))) {
          byQn.set(v.id, v);
        }
      }
      // 画质选项：以 accept_quality + accept_description 为准（含当前账号不可用的档位，标灰）
      const available = new Set([...byQn.keys()]);
      const descs = dash.accept_description || [];
      const acq = dash.accept_quality || [];
      const qualities = acq.map((q, i) => ({
        qn: q,
        label: descs[i] || biliQualityLabel(q),
        available: available.has(q),
      }));
      if (!qualities.length) {
        for (const [q] of byQn) qualities.push({ qn: q, label: biliQualityLabel(q), available: true });
      }
      return {
        mode: "dash", dash, streams: byQn,
        qualities: qualities.sort((a, b) => b.qn - a.qn),
        accept: acq,
        current: dash.quality,
        duration: dash.duration || 0,
      };
    }

    const j2 = await this.requestJson(buildUrl(0, qn), this.biliHeaders());
    if (j2.code !== 0 || !j2.data || !j2.data.durl || !j2.data.durl.length) {
      throw new Error(j2.message || "playurl 没有返回可播放流");
    }
    const durl = j2.data.durl;
    return {
      mode: "durl",
      durl,
      qualities: (j2.data.support_formats || []).map((f) => ({ qn: f.quality, label: f.new_description || biliQualityLabel(f.quality) }))
        .sort((a, b) => b.qn - a.qn),
      accept: j2.data.accept_quality || [],
      current: j2.data.quality,
      duration: durl.reduce((s, d) => s + (d.length || 0), 0),
    };
  }

  /** 从已解析的 DASH 结果里挑出目标画质的音视频流地址 */
  pickDashStream(stream, wantedQn) {
    const dash = stream.dash || {};
    const streams = stream.streams || new Map();
    const audios = (dash.audio || []).slice().sort((a, b) => (b.bandwidth || 0) - (a.bandwidth || 0));
    let video = streams.get(wantedQn);
    if (!video) {
      // 目标画质不可用 → 降级到有流的最低档
      const keys = [...streams.keys()].sort((a, b) => b - a);
      video = keys.length ? streams.get(keys[0]) : null;
    }
    const audio = audios[0];
    return {
      videoUrl: video ? (video.baseUrl || video.base_url) : "",
      audioUrl: audio ? (audio.baseUrl || audio.base_url) : "",
      width: video ? video.width : 0,
      height: video ? video.height : 0,
      qn: video ? video.id : 0,
    };
  }

  async fetchTranscript(link) {
    if (!cp || !this.settings.ytDlpPath) return [];
    if (!["bilibili", "youtube", "douyin", "direct"].includes(link.kind)) return [];
    const os = require("os");
    const pathApi = require("path");
    const fs = require("fs");
    const tmp = fs.mkdtempSync(pathApi.join(os.tmpdir(), "vns-"));
    try {
      const args = [
        "--skip-download", "--write-subs", "--write-auto-subs",
        "--sub-langs", this.settings.subsLangs || "zh-Hans,zh,en",
        "--sub-format", "vtt", "--no-playlist", "--no-warnings",
      ];
      if (link.kind === "bilibili" && this.biliCookieHeader()) args.push("--add-header", `Cookie: ${this.biliCookieHeader()}`);
      if (link.kind === "douyin") {
        if (link.mediaUrl) return []; // 抖音没有平台字幕，直链在 localTranscript 里直接转录
        if (this.douyinCookieHeader()) args.push("--add-header", `Cookie: ${this.douyinCookieHeader()}`);
      }
      args.push("-o", pathApi.join(tmp, "sub.%(ext)s"), link.url);
      await runProcess(this.settings.ytDlpPath, args, tmp);
      const files = fs.readdirSync(tmp).filter((f) => f.endsWith(".vtt"));
      if (!files.length) return [];
      const raw = fs.readFileSync(pathApi.join(tmp, files[0]), "utf8");
      return mergeLines(parseVtt(raw));
    } catch (e) {
      console.debug("[vns] 字幕获取失败", e.message);
      return [];
    } finally {
      try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) { /* ignore */ }
    }
  }

  async localTranscript(link) {
    if (!cp || !this.settings.asrEnabled) {
      this.settings.lastAsrError = "本地转录开关没打开";
      return [];
    }
    const fs = require("fs");
    const nodePath = require("path");
    const script = this.ensureBridgeFile() || this.bridgePath;
    const hasFile = !!(script && fs.existsSync(script));
    const embeddedSource = Buffer.from(ASR_BRIDGE_B64, "base64").toString("utf8");
    const workDir = hasFile ? nodePath.dirname(script) : require("os").tmpdir();
    let lastErr = "";
    for (const bin of this.pythonCandidates()) {
      try {
        const bridgeArgs = hasFile ? [script] : ["-c", embeddedSource];
        bridgeArgs.push(
          "--url", link.url,
          "--model", this.settings.asrModel || "small",
          "--language", this.settings.asrLanguage || "",
          "--ytdlp", this.settings.ytDlpPath || "yt-dlp",
        );
        if (link.mediaUrl) {
          bridgeArgs.push("--media-url", link.mediaUrl);
          bridgeArgs.push("--referer", link.kind === "douyin" ? "https://www.douyin.com/" : link.url);
        } else if (link.kind === "bilibili" && this.biliCookieHeader()) {
          bridgeArgs.push("--cookie", this.biliCookieHeader());
        } else if (link.kind === "douyin" && this.douyinCookieHeader()) {
          bridgeArgs.push("--cookie", this.douyinCookieHeader());
        }
        const out = await runProcess(bin, bridgeArgs, workDir, 30 * 60 * 1000);
        const line = String(out).trim().split(/\r?\n/).filter(Boolean).pop() || "{}";
        const parsed = JSON.parse(line);
        if (parsed.error) throw new Error(parsed.error);
        this.settings.lastAsrError = "";
        await this.saveSettings();
        const segs = (parsed.segments || []).map((x) => [Number(x[0]), String(x[1])]);
        if (!segs.length) {
          this.settings.lastAsrError = `识别到 0 段语音（语言检测 ${parsed.language || "?"}），这个视频大概率没人声/只有配乐`;
          await this.saveSettings();
          return [];
        }
        return segs;
      } catch (e) {
        lastErr = `${bin} → ${e.message}`;
        console.debug("[vns] 本地转录尝试失败", lastErr);
        if (!/ENOENT|not found|不是内部或外部命令/i.test(e.message)) break;
      }
    }
    this.settings.lastAsrError = lastErr;
    await this.saveSettings();
    new Notice(`本地转录失败：${lastErr}`, 10000);
    return [];
  }

  /* ---------- 模型能力 ---------- */
  async summarize(meta, text) {
    const head = `标题：${meta.title}\n来源：${meta.author || "未知"}\n\n正文/转录：\n${text.slice(0, 12000)}`;
    return chat(this.settings, [
      { role: "system", content: "你是严谨的中文笔记助手。只依据给定内容，不编造。输出 Markdown，始终使用简体中文，不要使用繁体字。" },
      { role: "user", content: `${head}\n\n请输出两节：\n## 概要\n2-4 句，说清这段内容到底在讲什么。\n## 要点\n3-7 条，每条具体到观点/步骤/结论，禁止写「介绍了…」。` },
    ]);
  }

  async translate(text) {
    const out = [];
    const chunks = String(text).match(/[\s\S]{1,4000}/g) || [];
    for (const c of chunks) {
      out.push(await chat(this.settings, [
        { role: "system", content: `把下面的内容翻译成${this.settings.translateTo === "zh" || !this.settings.translateTo ? "简体中文" : this.settings.translateTo}，保留时间戳与分段，不要解释。` },
        { role: "user", content: c },
      ]));
    }
    return out.join("\n\n");
  }

  async noteText() {
    const f = this.app.workspace.getActiveFile();
    if (!f) throw new Error("先打开一篇笔记");
    return { file: f, text: await this.app.vault.read(f) };
  }

  async summarizeCurrentNote() {
    const { file, text } = await this.noteText();
    const body = text.replace(/^---[\s\S]*?---/, "").trim();
    const md = await this.summarize({ title: file.basename }, body);
    await this.app.vault.process(file, (d) => `${d.trimEnd()}\n\n${md}\n`);
    new Notice("已追加 AI 摘要");
  }

  async translateCurrentNote() {
    const { file, text } = await this.noteText();
    const body = text.replace(/^---[\s\S]*?---/, "").trim().slice(0, 8000);
    const tr = await this.translate(body);
    await this.app.vault.process(file, (d) => `${d.trimEnd()}\n\n## 译文\n\n${tr}\n`);
    new Notice("已追加译文");
  }

  /* ---------- 贴链接 → 笔记 ---------- */
  async importLinkPrompt() { new UrlModal(this.app, (u) => this.importLink(u)).open(); }

  async importLink(rawUrl, opts = {}) {
    const url = extractUrl(rawUrl);
    if (!url) return null;
    let link = detectLink(url);
    link.url = url;
    if (link.kind === "short") {
      new Notice("正在解析分享短链…");
      link = await this.resolveShortLink(url);
    }
    new Notice(`解析 ${link.kind} 链接…`);

    // 抖音：没有播放直链就没法转录音频，先抓一次
    if (link.kind === "douyin") {
      const fromPlayer = opts.player && opts.player.link && opts.player.link.kind === "douyin"
        ? opts.player.link : null;
      if (fromPlayer) {
        link.mediaUrl = fromPlayer.mediaUrl || "";
        if (fromPlayer.title && !/^https?:/i.test(fromPlayer.title)) link.videoTitle = fromPlayer.title;
        if (fromPlayer.author) link.videoAuthor = fromPlayer.author;
        if (fromPlayer.stats) link.videoStats = fromPlayer.stats;
        if (fromPlayer.desc) link.videoDesc = fromPlayer.desc;
        if (fromPlayer.duration) link.duration = fromPlayer.duration;
      }
      link.mediaUrl = link.mediaUrl || "";
      if (!link.mediaUrl) {
        const cap = await this.captureDouyinMedia(link);
        if (cap) {
          link.mediaUrl = cap.mediaUrl || "";
          if (cap.duration) link.duration = cap.duration;
          if (cap.title) link.videoTitle = cap.title;
          if (cap.desc) link.videoDesc = cap.desc;
          if (cap.author) link.videoAuthor = cap.author;
          if (cap.stats) link.videoStats = cap.stats;
        }
      }
    }

    const meta = link.kind === "douyin"
      ? await this.douyinMeta(link)
      : await this.fetchMeta(link);
    if (link.videoTitle && (!meta.title || /^https?:/i.test(String(meta.title)))) meta.title = link.videoTitle;
    if (link.videoAuthor && !meta.author) meta.author = link.videoAuthor;
    if (link.videoStats && !meta.stats) meta.stats = link.videoStats;
    if (link.videoDesc && (!meta.description || meta.description.length < link.videoDesc.length)) {
      meta.description = link.videoDesc;
    }
    let transcript = [];
    if (["bilibili", "youtube", "douyin", "direct"].includes(link.kind)) {
      transcript = await this.fetchTranscript(link);
      if (!transcript.length) {
        // 复用上次的转录缓存，避免同一视频重复跑 Whisper
        const cached = await this.loadPanelData(link);
        if (cached && Array.isArray(cached.transcript) && cached.transcript.length) {
          transcript = cached.transcript;
          new Notice("复用上次的转录缓存", 3000);
        }
      }
      if (!transcript.length && this.settings.asrEnabled) {
        new Notice("没有平台字幕，改用本地 Whisper 转录（可能要 1-3 分钟）…", 6000);
        transcript = await this.localTranscript(link);
      }
    }
    let article = "";
    if (meta.html && ["weixin", "web", "netdisk"].includes(link.kind)) {
      article = htmlToText(meta.html).slice(0, 20000);
    }
    const bodyText = transcript.length ? transcript.map((x) => x[1]).join("\n") : article;

    let summary = "";
    if (this.settings.autoSummarize && this.hasLlm() && bodyText) {
      try { summary = await this.summarize(meta, bodyText); } catch (e) { summary = `> 摘要生成失败：${e.message}`; }
    }

    // 平台没给标题（抖音常见）时，从摘要/转录里起一个像样的标题，别拿 URL 当标题
    if (!meta.title || /^https?:/i.test(String(meta.title))) {
      const sp = splitSummary(summary);
      let derived = (sp.points || "").split("\n")[0].replace(/^[-*\s>]+/, "").replace(/\*\*/g, "").trim();
      if (!derived && transcript.length) derived = String(transcript[0][1] || "").trim();
      if (derived) {
        derived = derived.replace(/[。！？!?].*$/, "").slice(0, 40);
        if (derived.length >= 6) meta.title = derived;
      }
    }

    const md = this.buildNote(link, meta, { transcript, article, summary });
    await ensureFolder(this.app, this.settings.inboxFolder);
    const path = uniquePath(this.app, this.settings.inboxFolder, slug(meta.title));
    const file = await this.app.vault.create(path, md);
    this.noteIndex.set(url, path);
    // 概要 + 时间戳存到隐藏目录，供播放器下方面板读取
    await this.savePanelData(link, {
      title: meta.title,
      overview: splitSummary(summary).overview,
      transcript,
    });

    if (opts.player instanceof VideoPlayerView) {
      opts.player.notePath = path;
      opts.player.link = opts.player.link || link;
      opts.player.loadSummaryPanel().catch(() => {});
    }
    if (this.settings.autoCanvas) {
      try {
        const canvasPath = await this.makeCanvas(meta.title, md, this.settings.canvasFolder);
        await this.linkCanvasInNote(file, canvasPath);
      } catch (e) { console.debug(e); new Notice(`Canvas 生成失败：${e.message}`, 6000); }
    }
    new Notice(`已生成笔记：${path}`, 6000);
    return file;
  }

  buildNote(link, meta, parts) {
    const now = new Date();
    const today = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
    const tags = ["videos"];
    if (this.settings.clipperCompat) tags.push(this.settings.clipperTags || "clippings");

    // 只写用户要的 5 个字段：title / source / author / video_id / tags
    const fm = ["---", `title: ${fmValue(meta.title)}`, `source: ${fmValue(link.url)}`];
    if (meta.author) fm.push(`author: [${fmValue(meta.author)}]`);
    if (link.id) fm.push(`video_id: ${link.id}`);
    fm.push("tags:");
    for (const t of tags) fm.push(`  - ${t}`);
    fm.push("---", "");

    const body = [];
    // 不再写「播放」提示块；来源链接放在 frontmatter 的 source，点击可触发播放（见 registerObsidianProtocolHandler / 点击拦截）

    if (meta.description && String(meta.description).trim()) {
      body.push("## 简介", "", String(meta.description).trim().slice(0, 2000), "");
    }
    if (meta.stats) {
      body.push(`> ${meta.stats}`, "");
    }
    if (meta.tagList && meta.tagList.length) {
      body.push("## 标签", "", meta.tagList.map((t) => `\`${t}\``).join(" "), "");
    }
    if (meta.pages && meta.pages.length) {
      body.push("## 分P", "", ...meta.pages.map((p) => `- ${p}`), "");
    }
    if (parts.summary) {
      const sp = splitSummary(parts.summary);
      if (sp.points) body.push("## 要点", "", sp.points.trim(), "");
    }
    if (parts.article) {
      body.push("## 正文", "", parts.article.trim().slice(0, 12000), "");
    }
    // 「概要」与「时间戳」不再写进笔记：它们在播放器下方面板显示
    if (!parts.summary && !parts.transcript.length && !parts.article) {
      body.push("> [!warning] 没拿到正文：平台字幕没有，本地转录未成功，也没配模型。", "");
      if (this.settings.lastAsrError) {
        body.push(`> 本地转录报错：\`${String(this.settings.lastAsrError).slice(0, 200)}\``, "");
      }
    }
    return fm.join("\n") + body.join("\n");
  }

  /* ---------- Canvas ---------- */
  async makeCanvas(title, markdown, folder) {
    const source = String(markdown || "");
    const keySection = source.match(/##\s*(?:要点|核心论点|可执行启发)\s*\n([\s\S]*?)(?=\n##\s|$)/);
    const summarySection = source.match(/##\s*概要\s*\n([\s\S]*?)(?=\n##\s|$)/);
    const bulletSource = keySection ? keySection[1] : source;
    const clean = (text) => String(text)
      .replace(/^[-*]\s+/, "")
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/[*_`>#]/g, "")
      .trim();
    const bullets = bulletSource.split(/\r?\n/)
      .filter((l) => /^[-*]\s+/.test(l))
      .map(clean)
      .filter((t) => t && !/^打开 Canvas/.test(t))
      .slice(0, 16);
    if (!bullets.length) {
      const fallback = clean(source.replace(/^---[\s\S]*?---/, "")).slice(0, 600);
      if (fallback) bullets.push(fallback);
    }
    const summary = summarySection ? clean(summarySection[1]).slice(0, 700) : "";
    const nid = () => `n${Math.random().toString(36).slice(2, 10)}`;
    const nodes = [];
    const edges = [];
    const nodeHeight = (text) => Math.min(420, Math.max(108, Math.ceil(String(text).length / 22) * 20 + 48));
    const rootId = nid();
    const rootText = `# ${title}${summary ? `\n\n${summary}` : ""}`;
    nodes.push({ id: rootId, type: "text", text: rootText, x: 0, y: 0, width: 320, height: nodeHeight(rootText), color: "4" });
    let previous = nodes[0];
    let y = previous.y + previous.height + 48;
    for (const text of bullets) {
      const id = nid();
      const node = { id, type: "text", text: text.slice(0, 700), x: 0, y, width: 320, height: nodeHeight(text), color: "1" };
      nodes.push(node);
      edges.push({ id: nid(), fromNode: previous.id, toNode: id, fromSide: "bottom", toSide: "top" });
      previous = node;
      y += node.height + 32;
    }
    await ensureFolder(this.app, folder);
    const path = uniquePath(this.app, folder, `${slug(title)}-拆解`).replace(/\.md$/, ".canvas");
    await this.app.vault.create(path, JSON.stringify({ nodes, edges }, null, 2));
    new Notice(`已生成 Canvas：${path}`, 6000);
    return path;
  }

  async linkCanvasInNote(file, canvasPath) {
    if (!file || !canvasPath) return;
    const link = `[[${canvasPath}|打开 Canvas 白板]]`;
    await this.app.vault.process(file, (data) => {
      if (data.includes(canvasPath)) return data;
      const block = `> [!abstract] Canvas 拆解\n> ${link}`;
      const fmEnd = data.indexOf("\n---", 4);
      if (data.startsWith("---") && fmEnd > 0) {
        const at = fmEnd + 4;
        return data.slice(0, at) + `\n${block}\n` + data.slice(at);
      }
      return `${block}\n\n${data.trimStart()}`;
    });
  }

  async canvasFromActiveNote() {
    const { file, text } = await this.noteText();
    const canvasPath = await this.makeCanvas(file.basename, text, this.settings.canvasFolder);
    await this.linkCanvasInNote(file, canvasPath);
  }

  /* ---------- 拆书 ---------- */
  async distillBookPrompt() {
    new FilePickModal(this.app, BOOK_EXT, (f) => this.distillBook(f).catch((e) => this.fail(e)), "选一本书（md / txt / epub）").open();
  }

  async distillBook(file) {
    if (!this.hasLlm()) throw new Error("拆书需要模型 API Key 或开启 magpie 路由");
    new Notice(`读取《${file.basename}》…`);
    let chapters = [];
    if ((file.extension || "").toLowerCase() === "epub") {
      const buf = await this.app.vault.readBinary(file);
      chapters = parseEpub(buf).map((c) => ({ name: `${file.basename} · ${c.name}`, text: c.text }));
    } else {
      const text = await this.app.vault.read(file);
      chapters = splitChapters(text);
      if (!chapters.length) chapters = [{ name: file.basename, text }];
    }
    if (!chapters.length) throw new Error("没能切出章节");
    const outDir = `${this.settings.bookFolder}/${slug(file.basename)}`;
    await ensureFolder(this.app, outDir);
    const index = [`# 《${file.basename}》拆解`, "", `- 章节数：${chapters.length}`, `- 生成时间：${new Date().toLocaleString()}`, "", "## 章节", ""];
    let n = 0;
    for (const ch of chapters) {
      n += 1;
      new Notice(`拆解 ${n}/${chapters.length}…`, 1500);
      let md = "";
      try {
        md = await chat(this.settings, [
          { role: "system", content: "你是精读助手。只依据给定原文，不编造，输出 Markdown，始终使用简体中文，不要使用繁体字。" },
          { role: "user", content: `原文（章节：${ch.name}）：\n${ch.text.slice(0, 14000)}\n\n请输出：\n## 一句话总结\n## 核心论点\n（3-5 条，每条附原文关键句）\n## 概念与人物\n## 可执行启发\n（2-4 条）` },
        ], { maxTokens: 2500 });
      } catch (e) {
        md = `> 本章摘要生成失败：${e.message}`;
      }
      const head = `---\ntitle: ${fmValue(ch.name)}\nbook: ${fmValue(file.basename)}\nchapter: ${n}\ncreated: ${new Date().toISOString().slice(0, 10)}\ntags:\n  - book-notes\n---\n\n`;
      const path = uniquePath(this.app, outDir, `${pad2(n)} ${slug(ch.name)}`);
      await this.app.vault.create(path, head + md + "\n");
      index.push(`- [[${path.replace(/\.md$/, "")}|${headingOf(ch.name)}]]`);
    }
    await this.app.vault.create(uniquePath(this.app, outDir, "00 索引"), index.join("\n") + "\n");
    new Notice(`拆书完成：${outDir}`, 8000);
    this.recordHabit("distill-book");
  }

  /* ---------- OCR ---------- */
  async ocrPrompt() {
    new FilePickModal(this.app, ["png", "jpg", "jpeg", "webp", "gif", "bmp"], (f) => this.ocrImage(f).catch((e) => this.fail(e)), "选一张图片").open();
  }

  async ocrImage(file) {
    if (!this.settings.visionModel) throw new Error("先在设置里填「视觉模型」");
    const buf = await this.app.vault.readBinary(file);
    const b64 = Buffer.from(buf).toString("base64");
    const ext = (file.extension || "png").toLowerCase().replace("jpg", "jpeg");
    const md = await chat(this.settings, [{
      role: "user",
      content: [
        { type: "text", text: "把图片里的文字完整提取出来，保留标题层级和列表结构；如果有表格用 Markdown 表格。只输出内容，不要解释。" },
        { type: "image_url", image_url: { url: `data:image/${ext};base64,${b64}` } },
      ],
    }], { model: this.settings.visionModel, maxTokens: 3000 });

    await ensureFolder(this.app, this.settings.ocrFolder);
    const head = `---\ntitle: ${fmValue(file.basename)}\nsource: ${fmValue(file.path)}\ntype: ocr\ncreated: ${new Date().toISOString().slice(0, 10)}\ntags:\n  - ocr\n---\n\n![[${file.name}]]\n\n`;
    const path = uniquePath(this.app, this.settings.ocrFolder, `${slug(file.basename)}-OCR`);
    await this.app.vault.create(path, head + md + "\n");
    new Notice(`OCR 完成：${path}`, 6000);
  }

  /* ---------- Web Clipper 兼容 ---------- */
  async rebuildIndex() {
    this.noteIndex.clear();
    for (const f of this.app.vault.getMarkdownFiles()) {
      try {
        const head = await this.app.vault.cachedRead(f);
        if (!/^source:/m.test(head)) continue;
        const m = head.match(/^source:\s*"?([^"\n]+)"?/m);
        if (!m) continue;
        const url = m[1].trim();
        if (/bilibili\.com|youtube\.com|youtu\.be|douyin\.com/.test(url)) this.noteIndex.set(url, f.path);
      } catch (e) { /* ignore */ }
    }
    console.debug(`[vns] 索引到 ${this.noteIndex.size} 篇视频笔记`);
  }

  reindexFile() { /* 重命名后索引会在下次启动重建，这里保持轻量 */ }

  async enrichClippings() {
    const folder = this.settings.inboxFolder;
    const files = this.app.vault.getMarkdownFiles().filter((f) => f.path.startsWith(`${folder}/`));
    let done = 0;
    for (const f of files) {
      if (done >= 15) break;
      const text = await this.app.vault.cachedRead(f);
      if (!/^source:/m.test(text)) continue;
      if (/^## 时间戳/m.test(text)) continue;
      const m = text.match(/^source:\s*"?([^"\n]+)"?/m);
      if (!m) continue;
      const link = detectLink(m[1]);
      if (!["bilibili", "youtube", "douyin"].includes(link.kind)) continue;
      link.url = m[1].trim();
      new Notice(`补全 ${f.basename}…`, 1500);
      const transcript = await this.fetchTranscript(link);
      if (!transcript.length) continue;
      const section = ["", "## 时间戳", "", ...transcript.map(([t, s]) => `- [${fmtTime(t)}](${tsLink(link, t, this.settings.timestampMode)}) ${s}`), ""].join("\n");
      await this.app.vault.process(f, (d) => `${d.trimEnd()}\n${section}`);
      done += 1;
    }
    new Notice(done ? `已补全 ${done} 篇剪藏` : "没有需要补全的剪藏（或都没有字幕）", 6000);
  }

  /* ---------- 使用习惯 ---------- */
  recordHabit(kind) {
    if (!this.settings.habitEnabled) return;
    const h = this.settings.habits || { counters: {}, events: [] };
    h.counters[kind] = (h.counters[kind] || 0) + 1;
    h.events = [{ t: new Date().toISOString(), kind }].concat(h.events || []).slice(0, 200);
    this.settings.habits = h;
    clearTimeout(this._habitTimer);
    this._habitTimer = setTimeout(() => this.saveSettings().catch(() => {}), 2000);
  }

  async writeHabitNote() {
    const h = this.settings.habits || { counters: {}, events: [] };
    const rows = Object.entries(h.counters || {}).sort((a, b) => b[1] - a[1]);
    const lines = [
      `# 使用习惯`,
      "",
      `> 由 Video Note Studio 自动统计，最近更新 ${new Date().toLocaleString()}`,
      "",
      "## 功能使用频次",
      "",
      "| 操作 | 次数 |",
      "| --- | --- |",
      ...rows.map(([k, v]) => `| ${k} | ${v} |`),
      "",
      "## 最近操作",
      "",
      ...(h.events || []).slice(0, 30).map((e) => `- ${String(e.t).replace("T", " ").slice(0, 16)} · ${e.kind}`),
      "",
      "## 给后续开发的提示",
      "",
      ...(rows.length
        ? [`- 用得最多的是 \`${rows[0][0]}\`（${rows[0][1]} 次），优先打磨这条路径。`,
           `- 冷门操作：${rows.filter((r) => r[1] <= 1).map((r) => `\`${r[0]}\``).join("、") || "暂无"}，考虑合并或下线。`]
        : ["- 还没有统计数据，用几次功能后再生成。"]),
      "",
    ];
    await ensureFolder(this.app, (this.settings.habitNote || "").split("/").slice(0, -1).join("/") || ".");
    const existing = this.app.vault.getAbstractFileByPath(normalizePath(this.settings.habitNote));
    if (existing) await this.app.vault.modify(existing, lines.join("\n"));
    else await this.app.vault.create(normalizePath(this.settings.habitNote), lines.join("\n"));
    new Notice(`已更新习惯笔记：${this.settings.habitNote}`, 6000);
  }
}

function headingOf(name) { return String(name).replace(/[#\[\]|]/g, "").slice(0, 60); }

module.exports = VideoNoteStudio;
