QUnit.test('csv-quoted-data', function (assert) {
    var chart = Highcharts.charts[0];

    assert.strictEqual(
        chart.options.series[0].data.length,
        3,
        'Loaded Data'
    );

    assert.strictEqual(
        (chart.xAxis[0].names).length,
        3,
        'Has categories'
    );
});