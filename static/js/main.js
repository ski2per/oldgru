/*jslint browser:true */

var jQuery;
var wterm = {};


(function() {
  // For FormData without getter and setter
  var proto = FormData.prototype,
      data = {};

  if (!proto.get) {
    proto.get = function (name) {
      if (data[name] === undefined) {
        var input = document.querySelector('input[name="' + name + '"]'),
            value;
        if (input) {
          if (input.type === 'file') {
            value = input.files[0];
          } else {
            value = input.value;
          }
          data[name] = value;
        }
      }
      return data[name];
    };
  }

  if (!proto.set) {
    proto.set = function (name, value) {
      data[name] = value;
    };
  }
}());


jQuery(function($){
  var status = $('#status'),
      formID = '#ssh_cred',
      button = $('.btn-primary'),
      form_container = $('.form-container'),
      toolbar = $('#toolbar'),
      progress = $("#progress"),
      // upload = $("#uploader"),
      term_type = $('#term'),
      style = {},
      default_title = '',
      title_element = document.querySelector('title'),
      debug = document.querySelector(formID).noValidate,
      custom_font = document.fonts ? document.fonts.values().next().value : undefined,
      default_fonts,
      DISCONNECTED = 0,
      CONNECTING = 1,
      CONNECTED = 2,
      state = DISCONNECTED,
      messages = {1: 'This client is connecting ...', 2: 'This client is already connnected.'},
      key_max_size = 16384,
      fields = ['hostname', 'port', 'username'],
      form_keys = fields.concat(['password', 'totp']),
      opts_keys = ['bgcolor', 'title', 'encoding', 'command', 'term'],
      url_form_data = {},
      url_opts_data = {},
      validated_form_data,
      event_origin,
      hostname_tester = /((^\s*((([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5]))\s*$)|(^\s*((([0-9A-Fa-f]{1,4}:){7}([0-9A-Fa-f]{1,4}|:))|(([0-9A-Fa-f]{1,4}:){6}(:[0-9A-Fa-f]{1,4}|((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9A-Fa-f]{1,4}:){5}(((:[0-9A-Fa-f]{1,4}){1,2})|:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9A-Fa-f]{1,4}:){4}(((:[0-9A-Fa-f]{1,4}){1,3})|((:[0-9A-Fa-f]{1,4})?:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){3}(((:[0-9A-Fa-f]{1,4}){1,4})|((:[0-9A-Fa-f]{1,4}){0,2}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){2}(((:[0-9A-Fa-f]{1,4}){1,5})|((:[0-9A-Fa-f]{1,4}){0,3}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){1}(((:[0-9A-Fa-f]{1,4}){1,6})|((:[0-9A-Fa-f]{1,4}){0,4}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(:(((:[0-9A-Fa-f]{1,4}){1,7})|((:[0-9A-Fa-f]{1,4}){0,5}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:)))(%.+)?\s*$))|(^\s*((?=.{1,255}$)(?=.*[A-Za-z].*)[0-9A-Za-z](?:(?:[0-9A-Za-z]|\b-){0,61}[0-9A-Za-z])?(?:\.[0-9A-Za-z](?:(?:[0-9A-Za-z]|\b-){0,61}[0-9A-Za-z])?)*)\s*$)/;

  console.log("======================================")
  toolbar.hide()


  function storeItems(names, data) {
    var i, name, value;

    for (i = 0; i < names.length; i++) {
      name = names[i];
      value = data.get(name);
      if (value){
        window.localStorage.setItem(name, value);
      }
    }
  }


  function restoreItems(names) {
    var i, name, value;

    for (i=0; i < names.length; i++) {
      name = names[i];
      value = window.localStorage.getItem(name);
      if (value) {
        $('#'+name).val(value);
      }
    }
  }

  function populateForm(data) {
    var names = form_keys.concat(['passphrase']),
        i, name;

    for (i=0; i < names.length; i++) {
      name = names[i];
      $('#'+name).val(data.get(name));
    }
  }

  function getObjectLength(object) {
    return Object.keys(object).length;
  }

  function decode_uri(uri) {
    try {
      return decodeURI(uri);
    } catch(e) {
      console.error(e);
    }
    return '';
  }

  function decode_password(encoded) {
    try {
      return window.atob(encoded);
    } catch (e) {
       console.error(e);
    }
    return null;
  }

  function parse_url_data(string, form_keys, opts_keys, form_map, opts_map) {
    var i, pair, key, val,
        arr = string.split('&');

    for (i = 0; i < arr.length; i++) {
      pair = arr[i].split('=');
      key = pair[0].trim().toLowerCase();
      val = pair.slice(1).join('=').trim();

      if (form_keys.indexOf(key) >= 0) {
        form_map[key] = val;
      } else if (opts_keys.indexOf(key) >=0) {
        opts_map[key] = val;
      }
    }

    if (form_map.password) {
      form_map.password = decode_password(form_map.password);
    }
  }

  function parseXtermStyle() {
    var text = $('.xterm-helpers style').text();
    var arr = text.split('xterm-normal-char{width:');
    style.width = parseFloat(arr[1]);
    arr = text.split('div{height:');
    style.height = parseFloat(arr[1]);
  }

  function getCellSize(term) {
    style.width = term._core._renderService._renderer.dimensions.actualCellWidth;
    style.height = term._core._renderService._renderer.dimensions.actualCellHeight;
  }

  function toggleFullscreen(term) {
    $('#terminal .terminal').toggleClass('fullscreen');
    $('#toolbar .toolbar').toggleClass('fullscreen');
    term.fitAddon.fit();
  }


  function currentGeometry(term) {
    if (!style.width || !style.height) {
      try {
        getCellSize(term);
      } catch (TypeError) {
        parseXtermStyle();
      }
    }

    var cols = parseInt(window.innerWidth / style.width, 10) - 1;
    var rows = parseInt(window.innerHeight / style.height, 10);
    return {'cols': cols, 'rows': rows};
  }

  function resizeTerminal(term) {
    var geometry = currentGeometry(term);
    term.on_resize(geometry.cols, geometry.rows);
  }

  function setBackgoundColor(term, color) {
    term.setOption('theme', {
      background: color
    });
  }

  function isCustomFontLoaded() {
    if (!custom_font) {
      console.log('No custom font specified.');
    } else {
      console.log('Status of custom font ' + custom_font.family + ': ' + custom_font.status);
      if (custom_font.status === 'loaded') {
        return true;
      }
      if (custom_font.status === 'unloaded') {
        return false;
      }
    }
  }

  function updateFontFamily(term) {
    if (term.font_family_updated) {
      console.log('Already using custom font family');
      return;
    }

    if (!default_fonts) {
      default_fonts = term.getOption('fontFamily');
    }

    if (isCustomFontLoaded()) {
       var new_fonts =  custom_font.family + ', ' + default_fonts;
      var new_fonts =  "Hack" + ', ' + default_fonts;
      term.setOption('fontFamily', new_fonts);
      term.font_family_updated = true;
      console.log('Using custom font family ' + new_fonts);
    }
  }

  function reset_font_family(term) {
    if (!term.font_family_updated) {
      console.log('Already using default font family');
      return;
    }

    if (default_fonts) {
      term.setOption('fontFamily',  default_fonts);
      term.font_family_updated = false;
      console.log('Using default font family ' + default_fonts);
    }
  }

  function format_geometry(cols, rows) {
    return JSON.stringify({'cols': cols, 'rows': rows});
  }

  function read_as_text_with_decoder(file, callback, decoder) {
    var reader = new window.FileReader();

    if (decoder === undefined) {
      decoder = new window.TextDecoder('utf-8', {'fatal': true});
    }

    reader.onload = function() {
      var text;
      try {
        text = decoder.decode(reader.result);
      } catch (TypeError) {
        console.log('Decoding error happened.');
      } finally {
        if (callback) {
          callback(text);
        }
      }
    };

    reader.onerror = function (e) {
      console.error(e);
    };

    reader.readAsArrayBuffer(file);
  }

  function read_as_text_with_encoding(file, callback, encoding) {
    var reader = new window.FileReader();

    if (encoding === undefined) {
      encoding = 'utf-8';
    }

    reader.onload = function() {
      if (callback) {
        callback(reader.result);
      }
    };

    reader.onerror = function (e) {
      console.error(e);
    };

    reader.readAsText(file, encoding);
  }

  function read_file_as_text(file, callback, decoder) {
    if (!window.TextDecoder) {
      read_as_text_with_encoding(file, callback, decoder);
    } else {
      read_as_text_with_decoder(file, callback, decoder);
    }
  }

  function resetWssh() {
    var name;

    for (name in wterm) {
      if (wterm.hasOwnProperty(name) && name !== 'connect') {
        delete wterm[name];
      }
    }
  }

  function logStatus(text, to_populate) {
    status.html(text.split('\n').join('<br/>'));

    if (to_populate && validated_form_data) {
      populateForm(validated_form_data);
      validated_form_data = undefined;
    }

    if (form_container.css('display') === 'none') {
      form_container.show();
    }
  }

  function ajax_complete_callback(resp) {
    button.prop('disabled', false);

    if (resp.status !== 200) {
      logStatus(resp.status + ': ' + resp.statusText, true);
      state = DISCONNECTED;
      return;
    }

    var msg = resp.responseJSON;
    if (!msg.id) {
      logStatus(msg.status, true);
      state = DISCONNECTED;
      return;
    }

    var ws_url = window.location.href.split(/\?|#/, 1)[0].replace('http', 'ws'),
        join = (ws_url[ws_url.length-1] === '/' ? '' : '/'),
        url = ws_url + join + 'ws?id=' + msg.id,
        sock = new window.WebSocket(url),
        encoding = 'utf-8',
        decoder = window.TextDecoder ? new window.TextDecoder(encoding) : encoding,
        terminal = document.getElementById('terminal'),
        term = new window.Terminal({
          cursorBlink: true,
          theme: {
            background: url_opts_data.bgcolor || 'black'
          }
        });

    term.fitAddon = new window.FitAddon.FitAddon();
    term.loadAddon(term.fitAddon);

    console.log(url);
    if (!msg.encoding) {
      console.log('Unable to detect the default encoding of your server');
      msg.encoding = encoding;
    } else {
      console.log('The deault encoding of your server is ' + msg.encoding);
    }

    function termWrite(text) {
      if (term) {
        term.write(text);
        if (!term.resized) {
          resizeTerminal(term);
          term.resized = true;
        }
      }
    }

    function setEncoding(new_encoding) {
      // for console use
      if (!new_encoding) {
        console.log('An encoding is required');
        return;
      }

      if (!window.TextDecoder) {
        decoder = new_encoding;
        encoding = decoder;
        console.log('Set encoding to ' + encoding);
      } else {
        try {
          decoder = new window.TextDecoder(new_encoding);
          encoding = decoder.encoding;
          console.log('Set encoding to ' + encoding);
        } catch (RangeError) {
          console.log('Unknown encoding ' + new_encoding);
          return false;
        }
      }
    }

    wterm.setEncoding = setEncoding;

    if (url_opts_data.encoding) {
      if (setEncoding(url_opts_data.encoding) === false) {
        setEncoding(msg.encoding);
      }
    } else {
      setEncoding(msg.encoding);
    }


    wterm.geometry = function() {
      // for console use
      var geometry = currentGeometry(term);
      console.log('Current window geometry: ' + JSON.stringify(geometry));
    };

    wterm.send = function(data) {
      // for console use
      if (!sock) {
        console.log('Websocket was already closed');
        return;
      }

      if (typeof data !== 'string') {
        console.log('Only string is allowed');
        return;
      }

      try {
        JSON.parse(data);
        sock.send(data);
      } catch (SyntaxError) {
        data = data.trim() + '\r';
        sock.send(JSON.stringify({'data': data}));
      }
    };

    wterm.reset_encoding = function() {
      // for console use
      if (encoding === msg.encoding) {
        console.log('Already reset to ' + msg.encoding);
      } else {
        setEncoding(msg.encoding);
      }
    };

    wterm.resize = function(cols, rows) {
      // for console use
      if (term === undefined) {
        console.log('Terminal was already destroryed');
        return;
      }

      var valid_args = false;

      if (cols > 0 && rows > 0)  {
        var geometry = currentGeometry(term);
        if (cols <= geometry.cols && rows <= geometry.rows) {
          valid_args = true;
        }
      }

      if (!valid_args) {
        console.log('Unable to resize terminal to geometry: ' + format_geometry(cols, rows));
      } else {
        term.on_resize(cols, rows);
      }
    };

    wterm.set_bgcolor = function(color) {
      setBackgoundColor(term, color);
    };

    wterm.custom_font = function() {
      updateFontFamily(term);
    };

    wterm.default_font = function() {
      reset_font_family(term);
    };

    term.on_resize = function(cols, rows) {
      if (cols !== this.cols || rows !== this.rows) {
        console.log('Resizing terminal to geometry: ' + format_geometry(cols, rows));
        this.resize(cols, rows);
        sock.send(JSON.stringify({'resize': [cols, rows]}));
      }
    };

    term.onData(function(data) {
      // console.log(data);
      sock.send(JSON.stringify({'data': data}));
    });

    sock.onopen = function() {
      // Show toolbar
      toolbar.show();
      progress.hide();

      term.open(terminal);
      toggleFullscreen(term);
      updateFontFamily(term);
      term.focus();
      state = CONNECTED;
      title_element.text = url_opts_data.title || default_title;
      if (url_opts_data.command) {
        setTimeout(function () {
          sock.send(JSON.stringify({'data': url_opts_data.command+'\r'}));
        }, 500);
      }
    };

    sock.onmessage = function(msg) {
      read_file_as_text(msg.data, termWrite, decoder);
    };

    sock.onerror = function(e) {
      console.error(e);
    };

    sock.onclose = function(e) {
      // Hide toolbar again
      toolbar.hide()

      term.dispose();
      term = undefined;
      sock = undefined;
      resetWssh();
      logStatus(e.reason, true);
      state = DISCONNECTED;
      default_title = 'Term1nal';
      title_element.text = default_title;
    };

    $(window).resize(function(){
      if (term) {
        resizeTerminal(term);
      }
    });
  }

  function wrap_object(opts) {
    var obj = {};

    obj.get = function(attr) {
      return opts[attr] || '';
    };

    obj.set = function(attr, val) {
      opts[attr] = val;
    };

    return obj;
  }

  function cleanData(data) {
    var i, attr, val;
    var attrs = form_keys.concat(['privatekey', 'passphrase']);

    for (i = 0; i < attrs.length; i++) {
      attr = attrs[i];
      val = data.get(attr);
      if (typeof val === 'string') {
        data.set(attr, val.trim());
      }
    }
  }

  function validateFormData(data) {
    cleanData(data);

    var hostname = data.get('hostname'),
        port = data.get('port'),
        username = data.get('username'),
        pk = data.get('privatekey'),
        result = {
          valid: false,
          data: data,
          title: ''
        },
        errors = [], size;

    if (!hostname) {
      errors.push('Value of hostname is required.');
    } else {
      if (!hostname_tester.test(hostname)) {
         errors.push('Invalid hostname: ' + hostname);
      }
    }

    if (!port) {
      port = 22;
    } else {
      if (!(port > 0 && port < 65535)) {
        errors.push('Invalid port: ' + port);
      }
    }

    if (!username) {
      errors.push('Value of username is required.');
    }

    if (pk) {
      size = pk.size || pk.length;
      if (size > key_max_size) {
        errors.push('Invalid private key: ' + pk.name || '');
      }
    }

    if (!errors.length || debug) {
      result.valid = true;
      result.title = username + '@' + hostname + ':'  + port;
    }
    result.errors = errors;

    return result;
  }

  // Fix empty input file ajax submission error for safari 11.x
  function disable_file_inputs(inputs) {
    var i, input;

    for (i = 0; i < inputs.length; i++) {
      input = inputs[i];
      if (input.files.length === 0) {
        input.setAttribute('disabled', '');
      }
    }
  }

  function enable_file_inputs(inputs) {
    var i;

    for (i = 0; i < inputs.length; i++) {
      inputs[i].removeAttribute('disabled');
    }
  }

  function connect_without_options() {
    // use data from the form
    var form = document.querySelector(formID),
        inputs = form.querySelectorAll('input[type="file"]'),
        url = form.action,
        data, pk;

    disable_file_inputs(inputs);
    data = new FormData(form);
    pk = data.get('privatekey');
    enable_file_inputs(inputs);

    function ajax_post() {
      status.text('');
      button.prop('disabled', true);

      $.ajax({
          url: url,
          type: 'post',
          data: data,
          complete: ajax_complete_callback,
          cache: false,
          contentType: false,
          processData: false
      });
    }

    var result = validateFormData(data);
    if (!result.valid) {
      logStatus(result.errors.join('\n'));
      return;
    }

    if (pk && pk.size && !debug) {
      read_file_as_text(pk, function(text) {
        if (text === undefined) {
            logStatus('Invalid private key: ' + pk.name);
        } else {
          ajax_post();
        }
      });
    } else {
      ajax_post();
    }

    return result;
  }

  function connect_with_options(data) {
    // use data from the arguments
    var form = document.querySelector(formID),
        url = data.url || form.action,
        _xsrf = form.querySelector('input[name="_xsrf"]');

    var result = validateFormData(wrap_object(data));
    if (!result.valid) {
      logStatus(result.errors.join('\n'));
      return;
    }

    data.term = term_type.val();
    data._xsrf = _xsrf.value;
    if (event_origin) {
      data._origin = event_origin;
    }

    status.text('');
    button.prop('disabled', true);

    $.ajax({
        url: url,
        type: 'post',
        data: data,
        complete: ajax_complete_callback
    });

    return result;
  }

  function connect(hostname, port, username, password, privatekey, passphrase, totp) {
    // for console use
    var result, opts;

    if (state !== DISCONNECTED) {
      console.log(messages[state]);
      return;
    }

    if (hostname === undefined) {
      result = connect_without_options();
    } else {
      if (typeof hostname === 'string') {
        opts = {
          hostname: hostname,
          port: port,
          username: username,
          password: password,
          privatekey: privatekey,
          passphrase: passphrase,
          totp: totp
        };
      } else {
        opts = hostname;
      }

      result = connect_with_options(opts);
    }

    if (result) {
      state = CONNECTING;
      default_title = result.title;
      if (hostname) {
        validated_form_data = result.data;
      }
      storeItems(fields, result.data);
    }
  }

  wterm.connect = connect;

  $(formID).submit(function(event){
    event.preventDefault();
    connect();
  });

  $("#upload").change(function(){
    var file = this.files[0]
    console.log(typeof(file))
    console.log("shiiiiiiiiiiiiiiit")
    console.log(file.name)
    console.log(file.size)
    console.log(file.type)

    var formData = new FormData()
    formData.append("upload", file)

    $.ajax({
      url: '/upload',
      type: "POST",
      data: formData,
      cache: false,
      contentType: false,
      processData: false,
      timeout: 60000,

      xhr: function() {
        var theXHR = $.ajaxSettings.xhr();
        if(theXHR.upload) {
          progress.show();
          theXHR.upload.addEventListener('progress', function(e){
            if(e.lengthComputable){
              percent = Math.ceil(e.loaded / e.total * 100);
              console.log(percent);
              $(progress).attr("value", percent);
            }
          }, false);
        }
        return theXHR;
      },
      success: function(data) {
        progress.hide()
        console.log("uploaded")
      },
      error: function(error) {
        progress.hide()
        console.log(error)
      }
    }); //.ajax()
  }); //change()

  function cross_origin_connect(event)
  {
    console.log(event.origin);
    var prop = 'connect',
        args;

    try {
      args = JSON.parse(event.data);
    } catch (SyntaxError) {
      args = event.data.split('|');
    }

    if (!Array.isArray(args)) {
      args = [args];
    }

    try {
      event_origin = event.origin;
      wterm[prop].apply(wterm, args);
    } finally {
      event_origin = undefined;
    }
  }

  window.addEventListener('message', cross_origin_connect, false);

  if (document.fonts) {
    document.fonts.ready.then(
      function () {
        if (isCustomFontLoaded() === false) {
          document.body.style.fontFamily = custom_font.family;
        }
      }
    );
  }

  parse_url_data(
    decode_uri(window.location.search.substring(1)) + '&' + decode_uri(window.location.hash.substring(1)),
    form_keys, opts_keys, url_form_data, url_opts_data
  );

  if (url_opts_data.term) {
    term_type.val(url_opts_data.term);
  }

  if (url_form_data.password === null) {
    logStatus('Password via url must be encoded in base64.');
  } else {
    if (getObjectLength(url_form_data)) {
      connect(url_form_data);
    } else {
      restoreItems(fields);
      form_container.show();
    }
  }

});
