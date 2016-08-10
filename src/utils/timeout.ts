/**
 * @param subject
 * @param timeout
 * @param errorObject
 * @returns {ErrorCallback} - wrapped function
 */
export function timeout(subject:ErrorCallback, timeout:number, errorObject?:Error) {
    let called = false;
    errorObject = errorObject ? errorObject : new Error('Timed out');

    const wrapped = (err)=> {
        if (called) return;

        called = true;
        return subject(err);
    };

    setTimeout(
        ()=> {
            if (!called) {
                called = true;
                return subject(errorObject);
            }
        },
        timeout
    );

    return wrapped;
}
