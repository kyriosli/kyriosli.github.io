(function () {
    var modules = {react: React};
    var require = function (name) {
        return modules[name]
    };

    window.require = require;
})();