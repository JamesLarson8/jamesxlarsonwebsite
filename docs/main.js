"use strict";
window.onload = () => {
    console.log("Window loaded");
    const greeting = 'James Larson';
    const test = 'This site is currently under development';
    console.log("Greeting set");
    document.getElementById('greeting').textContent = greeting;
    document.getElementById('test').textContent = test;
};
