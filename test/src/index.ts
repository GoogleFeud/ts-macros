import {$$kindof} from "../../dist";

function $doSomethingBasedOnTypeOfParam(param: unknown) {
    if ($$kindof!(param) === 200) "Provided value is an array literal!";
    else if ($$kindof!(param) === 210) "Provided value is an arrow function!";
    else if ($$kindof!(param) === 204) "Provided value is a function call!";
}

$doSomethingBasedOnTypeOfParam!([1, 2, 3]);
$doSomethingBasedOnTypeOfParam!(console.log(1));
$doSomethingBasedOnTypeOfParam!(() => 1 + 1);
