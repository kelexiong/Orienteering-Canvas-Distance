# Canvas Distance App

## 项目简介
Canvas Distance App 是一个基于 Vue.js 的应用程序，允许用户在画布上绘制点，并计算这些点之间的距离。用户可以选择不同的画布尺寸（A4 或 A5），并使用比例尺功能来帮助进行精确的距离计算。

## 功能
- **画布组件**：用户可以在画布上绘制点，并实时计算点与点之间的距离。
- **点列表组件**：显示用户绘制的所有点的坐标和计算出的距离数据。
- **尺寸设置**：用户可以选择 A4 或 A5 尺寸的画布。
- **比例尺功能**：帮助用户进行精确的距离测量。

## 文件结构
```
canvas-distance-app
├── src
│   ├── components
│   │   ├── Canvas.vue        # 画布组件
│   │   └── PointList.vue     # 点列表组件
│   ├── views
│   │   └── Home.vue          # 主视图
│   ├── utils
│   │   └── distance.js       # 距离计算工具
│   ├── types
│   │   └── index.d.ts        # 类型定义
│   ├── App.vue               # 根组件
│   └── main.js               # 应用入口
├── public
│   └── index.html            # HTML 模板
├── package.json              # npm 配置
├── vite.config.js            # Vite 配置
└── README.md                 # 项目文档
```

## 安装与使用
1. 克隆项目：
   ```
   git clone <repository-url>
   cd canvas-distance-app
   ```

2. 安装依赖：
   ```
   npm install
   ```

3. 启动开发服务器：
   ```
   npm run dev
   ```

4. 打开浏览器访问 `http://localhost:3000` 查看应用。

## 贡献
欢迎任何形式的贡献！请提交问题或拉取请求。

## 许可证
此项目采用 MIT 许可证。