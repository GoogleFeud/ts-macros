import { AsRest } from "../../dist";

function $createClasses(values: AsRest<Array<string>>, ...names: Array<string>) {
    +[() => {
        class names {
            static value = values
        }
    }]
}

$createClasses!(["A", "B", "C"], "A", "B", "C")