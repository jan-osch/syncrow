import * as program from "commander";

/**
 * MAIN
 */
main();

function main() {
    program
        .version('0.0.4')
        .description('a real-time file synchronization tool')
        .command('init', 'initializes syncrow in current directory')
        .alias('i')
        .command('run', 'run syncrow in current directory', {isDefault: true})
        .alias('r');

    program.parse(process.argv);
}

