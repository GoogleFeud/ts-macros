import { $$ts } from "../../dist";

function $createClasses(strings: Array<string>) : void {
    //@ts-expect-error Purposeful
    +[[strings], (className: string) => {
        //@ts-expect-error Purposeful
        class className {

            test() {
                return 1 + 1;
            }
        }
    }];
}

$createClasses!(["A", "B", "C"]);