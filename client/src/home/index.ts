import '../style.css';
import Alpine from "alpinejs";
import Nav from "./Nav";
import App from "./App";

Alpine.data('app', App);
Alpine.data('nav', Nav);
Alpine.start();
