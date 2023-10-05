window.onload = (): void => {
    console.log("Window loaded");
    const greeting: string = 'James Larson';
    const test: string = '';
    console.log("Greeting set");
    document.getElementById('greeting')!.textContent = greeting;
    document.getElementById('test')!.textContent = test;
};