var DB = {
    dbName: 'mdd_images',
    dbVersion: 1,
    _db: null,

    open: function (callback) {
        if (DB._db) {
            if (callback) callback();
            return;
        }
        var request = indexedDB.open(DB.dbName, DB.dbVersion);
        request.onupgradeneeded = function (e) {
            var db = e.target.result;
            if (!db.objectStoreNames.contains('images')) {
                db.createObjectStore('images', { keyPath: 'id' });
            }
        };
        request.onsuccess = function (e) {
            DB._db = e.target.result;
            if (callback) callback();
        };
        request.onerror = function () {
            if (callback) callback();
        };
    },

    saveImage: function (blob, fileName, callback) {
        if (!DB._db) { if (callback) callback(null); return; }
        var id = Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 6);
        var record = {
            id: id,
            blob: blob,
            mimeType: blob.type || 'image/jpeg',
            fileName: fileName || 'photo.jpg',
            size: blob.size,
            createdAt: new Date().toISOString()
        };
        var tx = DB._db.transaction('images', 'readwrite');
        var store = tx.objectStore('images');
        store.put(record);
        tx.oncomplete = function () { if (callback) callback(id); };
        tx.onerror = function () { if (callback) callback(null); };
    },

    getImage: function (id, callback) {
        if (!DB._db) { if (callback) callback(null); return; }
        var tx = DB._db.transaction('images', 'readonly');
        var store = tx.objectStore('images');
        var request = store.get(id);
        request.onsuccess = function () { if (callback) callback(request.result || null); };
        request.onerror = function () { if (callback) callback(null); };
    },

    deleteImage: function (id, callback) {
        if (!DB._db) { if (callback) callback(); return; }
        var tx = DB._db.transaction('images', 'readwrite');
        var store = tx.objectStore('images');
        store.delete(id);
        tx.oncomplete = function () { if (callback) callback(); };
        tx.onerror = function () { if (callback) callback(); };
    },

    deleteImages: function (ids, callback) {
        if (!DB._db || !ids || ids.length === 0) { if (callback) callback(); return; }
        var tx = DB._db.transaction('images', 'readwrite');
        var store = tx.objectStore('images');
        for (var i = 0; i < ids.length; i++) {
            store.delete(ids[i]);
        }
        tx.oncomplete = function () { if (callback) callback(); };
        tx.onerror = function () { if (callback) callback(); };
    },

    resizeImage: function (file, maxSize, quality, callback) {
        maxSize = maxSize || 1600;
        quality = quality || 0.8;
        var reader = new FileReader();
        reader.onload = function (e) {
            var img = new Image();
            img.onload = function () {
                var w = img.width;
                var h = img.height;
                if (w > maxSize || h > maxSize) {
                    if (w > h) {
                        h = Math.round(h * maxSize / w);
                        w = maxSize;
                    } else {
                        w = Math.round(w * maxSize / h);
                        h = maxSize;
                    }
                }
                var canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;
                var ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, w, h);
                canvas.toBlob(function (blob) {
                    if (callback) callback(blob);
                }, 'image/jpeg', quality);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }
};
