---
title: react demo
layout: post
react: true
react_editor: true
css_editor: true
---

<css-editor>
sudoku-table {
    display: block;
    width: 324px;
    border: 1px #aaa;
    border-style: solid none none solid;
}

sudoku-table row {
    display: flex;
    border-bottom: 1px solid #aaa;
}

sudoku-table row cell {
    display: block;
    width: 36px;
    line-height: 36px;
    height: 36px;
    text-align: center;
    border-right: 1px solid #aaa;
    font-size: 24px;
}

sudoku-table row cell.dark {
    background: #eee
}

</css-editor>

<react-playground><!--
```js
import {Component} from 'react';

class SudokuTable extends Component {
    constructor(props) {
        super(props);
        this.values = [];
        this.state = {
            rows: []
        }
    }
    
    init (str) {
        let rows = [], values = this.values;
        for(let i = 0; i < 9; i++) {
            let row = rows[i] = [];
            for(let j = 0; j < 9; j++) {
                var idx = i * 9 + j;
                row.push({value: values[idx] = str[idx] | 0})
            }
        }
        
        this.setState({rows}) 
    }
    
    render () {
    	var self = this;
        return <sudoku-table>{this.state.rows.map((row, i) => 
            <SudokuRow key={i} isMiddle={i >=3 && i <=5} cells={row}/>
        )}</sudoku-table>
    }
}

class SudokuRow extends Component {

    shouldComponentUpdate(nextProps, nextState) {
        return nextProps.cells !== this.props.cells
    }
    
    render () {
        return <row>{this.props.cells.map((cell, i) => 
            <SudokuCell
                key={i}
                isDark={this.props.isMiddle !== (i >= 3 && i <= 5)}
                data={cell} />
        )}</row>
    }
}

class SudokuCell extends Component {
    shouldComponentUpdate(nextProps, nextState) {
        return nextProps.data !== this.props.data
    }

    render () {
        return <cell className={this.props.isDark ? 'dark' : 'light'}>
            {this.props.data.value || ''}</cell>
    }
}

var sudokuSolver = function () {
    var neighbours = [];
    for (var i = 0; i < 81; i++) {
        var x = i / 9 | 0, y = i % 9 | 0;
        var base_x = x - x % 3, base_y = y - y % 3;
        for (var j = 0; j < 9; j++) {
            if(j !== y) neighbours.push(x * 9 + j);
            if(j !== x) neighbours.push(j * 9 + y);
            var grid_x = base_x + (j / 3 | 0), grid_y = base_y + j % 3 | 0;
            if(grid_x !== x && grid_y !== y) neighbours.push(grid_x * 9 + grid_y);
        }
    }
    var tmps = new Array(810);
    
    return function (values) {
        recursive(0);
        
        function recursive(depth) {
            depth |= 0;
            if (depth === 81) return true;// stops iteration
            if (values[depth]) return recursive(depth + 1); // already has a value
            var offset = (depth << 3) + (depth << 1);
            // empty memory zone
            for(var i = 1; i <= 9; i++) tmps[offset + i | 0] = 0;
            // mark unavailables
            for (var k = offset << 1, n = k + 20; k < n; k++) {
                tmps[offset + values[neighbours[k]] | 0] = 1;
            }
            for(var i = 1; i <= 9; i++) {
                if(tmps[offset + i | 0]) continue;
                values[depth] = i;
                if (recursive(depth + 1)) return true;
            }
            values[depth] = 0;
            return false;
        }   
    }
}();


var table;

ReactDOM.render(
    <div>
        <SudokuTable ref={_table => {table = _table}}/>
        <button onClick={solve}>solve</button>
        <button onClick={reset}>reset</button>
        <button onClick={reset2}>reset 2</button>
        <button onClick={reset3}>reset 3</button>
        <button onClick={reset4}>reset 4</button>
    </div>
, mountNode);

reset();

function reset() {
    table.init("1.......9.6.8.7.5...7...2..21..5..93...4.8...43..2..87..1...9...5.6.9.4.6.......8")
}
function reset2() {
    table.init("..53.....8......2..7..1.5..4....53...1..7...6..32...8..6.5....9..4....3......97..")
}
function reset3() {
    table.init("8..........36......7..9.2...5...7.......457.....1...3...1....68..85...1..9....4..")
}
function reset4() {
    table.init("98.7..6..5...9..7...7..4...3.....2...1......4..94...8...65...9.....2.1.......6..3")
}

function solve () {
    console.time('sudoku solver');
    sudokuSolver(table.values);
    console.timeEnd('sudoku solver');
    table.init(table.values);
}

```
--></react-playground>