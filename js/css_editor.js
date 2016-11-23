(function () {
    var elem = document.querySelector('css-editor'), content = elem.innerHTML;
    elem.innerHTML = '<textarea>' + content + '</textarea>';
    elem.insertAdjacentHTML('afterEnd', '<style type="text/css">' + content + '</style>');
    var codeMirror = CodeMirror.fromTextArea(elem.firstElementChild, {
        mode: 'css'
    });
    var style = elem.nextElementSibling;
    codeMirror.on('change', function (self, change) {
        style.innerHTML = self.getValue();
    })
})();