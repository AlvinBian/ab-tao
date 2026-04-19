import ElementPlus from "element-plus";
import zhTw from "element-plus/es/locale/lang/zh-tw";
import { createPinia } from "pinia";
import { createApp } from "vue";
import "element-plus/dist/index.css";
import "element-plus/theme-chalk/dark/css-vars.css";
import App from "./App.vue";
import router from "./router";
import "./assets/main.css";

const app = createApp(App);

app.use(createPinia());
app.use(router);
app.use(ElementPlus, { locale: zhTw });

app.mount("#app");
