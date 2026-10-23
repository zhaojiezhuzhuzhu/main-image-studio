# 可选内部抠图模型

U²-Net 供内部 `engine: 'model'` 调用使用。制作界面的白底图处理使用本机 Photoshop 2020 或更高版本。

使用模型时，将交接包 `04_可选资源/本机抠图模型/u2net.onnx` 复制到本目录；也可在应用根目录执行 `npm run prepare:cutout` 下载并校验。部署模型方案时，模型随本目录静态资源提供。

来源：https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2net.onnx

上游 MD5：`60024c5c889badc19c04ad937298a77b`

模型原项目：https://github.com/xuebinqin/U-2-Net

模型作者：Xuebin Qin、Zichen Zhang、Chenyang Huang、Masood Dehghan、Osmar R. Zaiane、Martin Jagersand。许可证见 LICENSE-U2Net.txt。浏览器运行时许可证见 LICENSE-ONNX-Runtime.txt。
