/* eslint func-style:0 */


QUnit.test('Container initially hidden (#6693)', function (assert) {
    var chart = Highcharts.chart('container', {
        series: [{
            type: 'column',
            data: [1, 3, 2, 4]
        }]
    });

    document.getElementById('container').style.display = 'block';
    document.getElementById('outer').style.display = 'block';
    document.getElementById('outer').style.visibility = 'visible';
    document.getElementById('outer-outer').style.display = 'block';
    document.getElementById('outer-outer').style.visibility = 'visible';

    assert.strictEqual(
        chart.chartHeight,
        300,
        'Correct chart height when hidden'
    );
});

QUnit.test('Container originally detached (#5783)', function (assert) {
    var c = document.createElement('div');

    c.style.width = '200px';
    c.style.height = '200px';

    var chart = Highcharts.chart({
        chart: {
            renderTo: c
        },
        title: {
            text: 'The height of the chart is set to 200px'
        },
        xAxis: {
            categories: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        },
        series: [{
            data: [29.9, 71.5, 106.4, 129.2, 144.0, 176.0, 135.6, 148.5, 216.4, 194.1, 95.6, 54.4]
        }]
    });

    document.getElementById('container').appendChild(c);

    assert.strictEqual(
        chart.chartWidth,
        200,
        'Chart width detected from CSS of detached container'
    );

    chart = Highcharts.chart({
        chart: {
            renderTo: c
        },
        title: {
            text: 'The second chart in the same container'
        },
        xAxis: {
            categories: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        },
        series: [{
            data: [29.9, 71.5, 106.4, 129.2, 144.0, 176.0, 135.6, 148.5, 216.4, 194.1, 95.6, 54.4],
            type: 'column'
        }]
    });
});