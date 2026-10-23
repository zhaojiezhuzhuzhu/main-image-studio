(function () {
    var request = SKU_CUTOUT_REQUEST;
    var previousDialogs = app.displayDialogs;
    var previousDocument = app.documents.length ? app.activeDocument : null;
    var source = null;
    app.displayDialogs = DialogModes.NO;
    try {
        source = app.open(new File(request.input));
        if (source.mode !== DocumentMode.RGB) source.changeMode(ChangeMode.RGB);
        source.bitsPerChannel = BitsPerChannelType.EIGHT;
        var pathSource = "embedded-path";
        if (!source.pathItems.length) {
            // A plain JPG without an embedded path can still use Photoshop's Select Subject.
            var descriptor = new ActionDescriptor();
            descriptor.putBoolean(stringIDToTypeID("sampleAllLayers"), false);
            executeAction(stringIDToTypeID("autoCutout"), descriptor, DialogModes.NO);
            source.selection.makeWorkPath(1.0);
            pathSource = "subject-path";
        }
        if (!source.pathItems.length) throw new Error("未能找到或生成产品路径，请检查原图");
        // A JPG can carry separate material/part paths before the whole-product path.
        // Prefer the largest saved outline; ignore an unfinished work path when saved paths exist.
        var hasSavedPath = false;
        for (var i = 0; i < source.pathItems.length; i++) {
            if (source.pathItems[i].kind !== PathKind.WORKPATH) hasSavedPath = true;
        }
        var path = null, pathIndex = -1, largestArea = 0;
        for (var j = 0; j < source.pathItems.length; j++) {
            var candidate = source.pathItems[j];
            if (hasSavedPath && candidate.kind === PathKind.WORKPATH) continue;
            try {
                candidate.makeSelection(0, true, SelectionType.REPLACE);
                var extent = source.selection.bounds;
                var area = (extent[2].as("px") - extent[0].as("px")) * (extent[3].as("px") - extent[1].as("px"));
                if (area > largestArea) { path = candidate; pathIndex = j; largestArea = area; }
            } catch (emptyPath) { /* A saved empty path is not a product outline. */ }
        }
        if (path === null) throw new Error("未能找到完整产品路径，请检查原图");
        path.makeSelection(0, true, SelectionType.REPLACE);
        var bounds = source.selection.bounds;
        source.flatten();
        source.activeLayer.isBackgroundLayer = false;
        source.selection.invert();
        source.selection.clear();
        source.selection.deselect();
        var options = new PNGSaveOptions(); options.interlaced = false; options.compression = 6;
        source.saveAs(new File(request.output), options, true, Extension.LOWERCASE);
        var report = new File(request.report); report.encoding = "UTF8";
        if (!report.open("w")) throw new Error("无法保存抠图结果记录");
        report.write('{"method":"' + pathSource + '","pathIndex":' + pathIndex + ',"width":' + source.width.as("px") + ',"height":' + source.height.as("px") + ',"bounds":[' + [bounds[0].as("px"), bounds[1].as("px"), bounds[2].as("px"), bounds[3].as("px")].join(",") + ']}');
        report.close();
    } finally {
        if (source !== null) source.close(SaveOptions.DONOTSAVECHANGES);
        if (previousDocument !== null) { try { app.activeDocument = previousDocument; } catch (ignore) {} }
        app.displayDialogs = previousDialogs;
    }
}());
