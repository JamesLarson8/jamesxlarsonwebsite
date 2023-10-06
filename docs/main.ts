window.onload = (): void => {
    console.log("Window loaded");
    const greeting: string = 'James Larson';
    const devmessage: string = 'This site is currently under development';
    console.log("Greeting set");
    document.getElementById('greeting')!.textContent = greeting;
    document.getElementById('test')!.textContent = devmessage;
};