import '../App.css';
import { useState } from 'react';

// function primesUpto(n) {
//     // Eratosthenes algorithm to find all primes under n
//     var array = [];
//     var output = [];

//     // Make an array from 2 to (n - 1)
//     for (var h = 0; h <= n+0.5; h++) {
//         array.push(true);
//     }

//     // Remove multiples of primes starting from 2, 3, 5,...
//     for (var i = 2; i <= n; i++) {
//         if (array[i]) {
//             for (var j = i * i; j < n; j += i) {
//                 array[j] = false;
//             }
//         }
//     }

//     // All array[i] set to true are primes
//     for (var k = 2; k < n; k++) {
//         if(array[k]) {
//             output.push(k);
//         }
//     }

//     return output;
// };

function nextPrime(primes, limit) {
    if(primes.length === 0) {
        primes.push(2);
        return 2;
    }

    const lastPrime = primes[primes.length - 1];
    if(lastPrime === 2) {
      primes.push(3);
      return 3;
    }

    for(let i = lastPrime + 2; i <= limit; i += 2) {
        if(primes.every(prime => i % prime !== 0)) {
            primes.push(i);
            return i;
        }
    }
    return limit;
}

function factorThis(number) {
  var output = [];
  var remaining = number;
  var primes = [];


  while(remaining > 1) {
    var currPrime = nextPrime(primes, remaining);
    while(remaining % currPrime === 0) {
      output.push(currPrime.toLocaleString());
      remaining /= currPrime;
    }
    if(remaining === 1) {
      break;
    }
    if(currPrime > Math.sqrt(remaining)) {
      output.push(remaining.toLocaleString());
      break;
    }
  }
  return {factoring: output.join("  x  "), primes: primes};
}

export default function FactorMe() {
  const params = new URLSearchParams(window.location.search);
  const initialNumber = Number(params.get('number')) || 42;
  const [number, setNumber] = useState(initialNumber);
  const [inputValue, setInputValue] = useState(initialNumber);
  const [multiplyValue, setMultiplyValue] = useState(2);
  
  const startTime = performance.now();

  //const primes = primesUpto(Math.sqrt(number));
  const {factoring, primes} = factorThis(number);

  const endTime = performance.now();
  const timeElapsed = (endTime - startTime).toFixed(2);

  const handleSubmit = (e) => {
    e.preventDefault();
    setNumber(Number(inputValue));
  };
    
  const handlePrev = () => {
    setNumber(prevNumber => prevNumber - 1);
  };    
  const handleNext = () => {
    setNumber(prevNumber => prevNumber + 1);
  };
  
  const handleMultiply = () => {
    if (multiplyValue) {
      setNumber(prevNumber => Math.round(prevNumber * Number(multiplyValue)));
    }
  };
  
  return (
    <div className="basic">
      <form onSubmit={handleSubmit} style={{ marginBottom: '20px' }}>
        <input 
          type="number" 
          value={inputValue} 
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Enter a number"
        />
        <button type="submit" style={{ marginRight: '50px' }}>Factor Me!</button>

        <button type="button" onClick={handlePrev}>-1</button>
        <span style={{ margin: '10px' }}><b>{number.toLocaleString()}</b></span>
        <button type="button" onClick={handleNext}>+1</button>

        <button type="button" onClick={handleMultiply} style={{ marginLeft: '20px' }}>Multiply by ...</button>
        <input 
          type="number" 
          value={multiplyValue}
          onChange={(e) => setMultiplyValue(e.target.value)}
          placeholder="Multiply by..."
          style={{ width: '50px', marginLeft: '5px' }}
        />
      </form>

      <h3>{number.toLocaleString()} = {factoring}</h3>
      <p>Calculation time: {timeElapsed} milliseconds</p>
      {primes.length > 10 ? (
        <p>{primes.length.toLocaleString()} primes considered</p>
      ) : (
        <p>{primes.length.toLocaleString()} primes considered: {primes.join(", ")}</p>
      )}
    </div>
  );
}



//export default App;
