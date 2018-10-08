/**
 * Events generator for Stock tools
 *
 * (c) 2009-2018 Paweł Fus
 *
 * License: www.highcharts.com/license
 */
'use strict';
import H from '../parts/Globals.js';

var addEvent = H.addEvent,
    correctFloat = H.correctFloat,
    defined = H.defined,
    doc = H.doc,
    each = H.each,
    extend = H.extend,
    fireEvent = H.fireEvent,
    grep = H.grep,
    inArray = H.inArray,
    isNumber = H.isNumber,
    isArray = H.isArray,
    isObject = H.isObject,
    map = H.map,
    objectEach = H.objectEach,
    pick = H.pick,
    PREFIX = 'highcharts-';

var bindingsUtils = {
    /**
     * Get field type according to value
     *
     * @param {*} Atomic type (one of: string, number, boolean)
     * @return Field type (one of: text, number, checkbox)
     *
     */
    getFieldType: function getType(value) {
        return {
            string: 'text',
            number: 'number',
            boolean: 'checkbox'
        }[typeof value];
    },
    /**
     * Shorthand to check if given yAxis comes from navigator.
     *
     * @param {Axis} Axis
     * @return {Boolean}
     * @private
     */
    isNotNavigatorYAxis: function (axis) {
        return axis.userOptions.className !== PREFIX + 'navigator-yaxis';
    },
    /**
     * Update each point after specified index, most of the annotations use
     * this. For example crooked line: logic behind updating each point is the
     * same, only index changes when adding an annotation.
     *
     * Example: Toolbar.utils.updateNthPoint(1) - will generate function that
     * updates all consecutive points except point with index=0.
     *
     * @param {Number} Index from each point should udpated
     *
     * @return {function} Callback to be used in steps array
     */
    updateNthPoint: function (startIndex) {
        return function (e, annotation) {
            var options = annotation.options.typeOptions,
                x = this.chart.xAxis[0].toValue(e.chartX),
                y = this.chart.yAxis[0].toValue(e.chartY);

            each(options.points, function (point, index) {
                if (index >= startIndex) {
                    point.x = x;
                    point.y = y;
                }
            });

            annotation.update({
                typeOptions: {
                    points: options.points
                }
            });
        };
    },
    /**
     * Update height for an annotation. Height is calculated as a difference
     * between last point in `typeOptions` and current position. It's a value,
     * not pixels height.
     *
     * @param {Event} event - normalized browser event
     * @param {Annotation} annotation - annotation to be updated
     * @private
     */
    updateHeight: function (e, annotation) {
        annotation.update({
            typeOptions: {
                height: this.chart.yAxis[0].toValue(e.chartY) -
                    annotation.options.typeOptions.points[1].y
            }
        });
    },
    // TO DO: Consider using getHoverData(), but always kdTree (columns?)
    attractToPoint: function (e, chart) {
        var x = chart.xAxis[0].toValue(e.chartX),
            y = chart.yAxis[0].toValue(e.chartY),
            distX = Number.MAX_SAFE_INTEGER, // IE?
            closestPoint;

        each(chart.series, function (series) {
            each(series.points, function (point) {
                if (point && distX > Math.abs(point.x - x)) {
                    distX = Math.abs(point.x - x);
                    closestPoint = point;
                }
            });
        });

        return {
            x: closestPoint.x,
            y: closestPoint.y,
            below: y < closestPoint.y,
            series: closestPoint.series,
            xAxis: closestPoint.series.xAxis.index || 0,
            yAxis: closestPoint.series.yAxis.index || 0
        };
    },
    /**
     * Generates function which will add a flag series using modal in GUI.
     * Method fires an event "showForm" with config:
     * `{type, options, callback}`.
     *
     * Example: Toolbar.utils.addFlagFromForm('url(...)') - will generate
     * function that shows modal in GUI.
     *
     * @param {String} Type of flag series, e.g. "squarepin"
     *
     * @return {function} Callback to be used in `start` callback
     */
    addFlagFromForm: function (type) {
        return function (e) {
            var toolbar = this,
                chart = toolbar.chart,
                getFieldType = toolbar.utils.getFieldType,
                point = bindingsUtils.attractToPoint(e, chart);

            fireEvent(
                toolbar,
                'showForm',
                {
                    formType: 'flag',
                    // Enabled options:
                    options: {
                        title: ['A', getFieldType('A')],
                        name: ['Flag A', getFieldType('Flag A')]
                    },
                    // Callback on submit:
                    onSubmit: function (data) {
                        var pointConfig = {
                            x: point.x,
                            y: point.y
                        };

                        toolbar.fieldsToOptions(data.fields, pointConfig);

                        chart.addSeries({
                            type: 'flags',
                            onSeries: point.series.id,
                            shape: type,
                            data: [pointConfig],
                            point: {
                                events: {
                                    click: function () {
                                        var point = this,
                                            options = point.options;

                                        fireEvent(
                                            toolbar,
                                            'showForm',
                                            {
                                                formType: 'annotation-toolbar',
                                                options: {
                                                    title: [
                                                        options.title,
                                                        getFieldType(
                                                            options.title
                                                        )
                                                    ],
                                                    name: [
                                                        options.name,
                                                        getFieldType(
                                                            options.name
                                                        )
                                                    ],
                                                    type: 'Flag'
                                                },
                                                onSubmit: function () {
                                                    point.update(
                                                        toolbar.fieldsToOptions(
                                                            data.fields,
                                                            {}
                                                        )
                                                    );
                                                }
                                            }
                                        );
                                    }
                                }
                            }
                        });
                    }
                }
            );
        };
    },
    manageIndicators: function (data) {
        var toolbar = this,
            chart = toolbar.chart,
            seriesConfig = {
                linkedTo: data.linkedTo,
                type: data.type
            },
            indicatorsWithAxes = [
                'atr',
                'cci',
                'macd',
                'roc',
                'rsi'
            ],
            yAxis,
            series;

        if (data.actionType === 'edit') {
            toolbar.fieldsToOptions(data.fields, seriesConfig);
            series = chart.get(data.seriesId);

            if (series) {
                series.update(seriesConfig, false);
            }
        } else if (data.actionType === 'remove') {
            series = chart.get(data.seriesId);
            if (series) {
                yAxis = series.yAxis;

                if (series.linkedSeries) {
                    each(series.linkedSeries, function (linkedSeries) {
                        linkedSeries.remove(false);
                    });
                }

                series.remove(false);

                if (inArray(series.type, indicatorsWithAxes) >= 0) {
                    yAxis.remove(false);
                    toolbar.resizeYAxes();
                }
            }
        } else {
            seriesConfig.id = H.uniqueKey();
            toolbar.fieldsToOptions(data.fields, seriesConfig);

            if (inArray(data.type, indicatorsWithAxes) >= 0) {
                yAxis = chart.addAxis({
                    id: H.uniqueKey(),
                    offset: 0,
                    opposite: true,
                    title: {
                        text: ''
                    },
                    tickPixelInterval: 40,
                    showLastLabel: false,
                    labels: {
                        align: 'left',
                        y: -2
                    }
                }, false, false);
                seriesConfig.yAxis = yAxis.options.id;
                toolbar.resizeYAxes();
            }
            chart.addSeries(seriesConfig, false);
        }

        fireEvent(
            toolbar,
            'deselectButton',
            {
                button: toolbar.selectedButtonElement
            }
        );

        chart.redraw();
    }
};

/**
 * Update size of background (rect) in some annotations: Measure, Simple Rect.
 *
 * @param {Event} event - normalized browser event
 * @param {Annotation} annotation - annotation to be updated
 */
function updateRectSize(event, annotation) {
    var options = annotation.options.typeOptions,
        xStart = this.chart.xAxis[0].toPixels(options.point.x),
        yStart = this.chart.yAxis[0].toPixels(options.point.y),
        x = event.chartX,
        y = event.chartY,
        width = x - xStart,
        height = y - yStart;

    annotation.update({
        typeOptions: {
            background: {
                width: width + 'px',
                height: height + 'px'
            }
        }
    });
}

var stockToolsBindings = {
    // Simple annotations:
    'circle-annotation': {
        start: function (e) {
            var x = this.chart.xAxis[0].toValue(e.chartX),
                y = this.chart.yAxis[0].toValue(e.chartY),
                annotation;

            annotation = this.chart.addAnnotation({
                shapes: [{
                    type: 'circle',
                    point: {
                        xAxis: 0,
                        yAxis: 0,
                        x: x,
                        y: y
                    },
                    r: 5,
                    controlPoints: [{
                        positioner: function (target) {
                            var xy = H.Annotation.MockPoint.pointToPixels(
                                    target.points[0]
                                ),
                                r = target.options.r;

                            return {
                                x: xy.x + r * Math.cos(Math.PI / 4) -
                                    this.graphic.width / 2,
                                y: xy.y + r * Math.sin(Math.PI / 4) -
                                    this.graphic.height / 2
                            };
                        },
                        events: {
                            // TRANSFORM RADIUS ACCORDING TO Y TRANSLATION
                            drag: function (e, target) {

                                target.setRadius(
                                    Math.max(
                                        target.options.r +
                                            this.mouseMoveToTranslation(e).y /
                                            Math.sin(Math.PI / 4),
                                        5
                                    )
                                );

                                target.redraw(false);
                            }
                        }
                    }]
                }]
            });

            return annotation;
        },
        steps: [
            function (e, annotation) {
                var point = annotation.options.shapes[0].point,
                    x = this.chart.xAxis[0].toPixels(point.x),
                    y = this.chart.yAxis[0].toPixels(point.y),
                    distance = Math.max(
                        Math.sqrt(
                            Math.pow(x - e.chartX, 2) +
                            Math.pow(y - e.chartY, 2)
                        ),
                        5
                    );

                // TO DO: Is update broken?
                // annotation.options.shapes[0].r = distance;
                annotation.update({
                    shapes: [{
                        r: distance
                    }]
                });
            }
        ]
    },
    'rectangle-annotation': {
        start: function (e) {
            var x = this.chart.xAxis[0].toValue(e.chartX),
                y = this.chart.yAxis[0].toValue(e.chartY),
                options = {
                    type: 'measure',
                    typeOptions: {
                        point: {
                            x: x,
                            y: y,
                            xAxis: 0,
                            yAxis: 0
                        },
                        background: {
                            width: 0,
                            height: 0,
                            strokeWidth: 0,
                            stroke: '#ffffff'
                        },
                        crosshairX: {
                            enabled: false
                        },
                        crosshairY: {
                            enabled: false
                        },
                        label: {
                            enabled: false
                        }
                    }
                };

            return this.chart.addAnnotation(options);
        },
        steps: [
            updateRectSize
        ]
    },
    'label-annotation': {
        start: function (e) {
            var x = this.chart.xAxis[0].toValue(e.chartX),
                y = this.chart.yAxis[0].toValue(e.chartY);

            this.chart.addAnnotation({
                labelOptions: {
                    format: '{y:.2f}'
                },
                labels: [{
                    point: {
                        x: x,
                        y: y,
                        xAxis: 0,
                        yAxis: 0
                    },
                    controlPoints: [{
                        symbol: 'triangle-down',
                        positioner: function (target) {
                            if (!target.graphic.placed) {
                                return {
                                    x: 0,
                                    y: -9e7
                                };
                            }

                            var xy = H.Annotation.MockPoint
                                .pointToPixels(
                                    target.points[0]
                                );

                            return {
                                x: xy.x - this.graphic.width / 2,
                                y: xy.y - this.graphic.height / 2
                            };
                        },

                        // TRANSLATE POINT/ANCHOR
                        events: {
                            drag: function (e, target) {
                                var xy = this.mouseMoveToTranslation(e);

                                target.translatePoint(xy.x, xy.y);
                                target.redraw(false);
                            }
                        }
                    }, {
                        symbol: 'square',
                        positioner: function (target) {
                            if (!target.graphic.placed) {
                                return {
                                    x: 0,
                                    y: -9e7
                                };
                            }

                            return {
                                x: target.graphic.alignAttr.x -
                                    this.graphic.width / 2,
                                y: target.graphic.alignAttr.y -
                                    this.graphic.height / 2
                            };
                        },

                        // TRANSLATE POSITION WITHOUT CHANGING THE ANCHOR
                        events: {
                            drag: function (e, target) {
                                var xy = this.mouseMoveToTranslation(e);

                                target.translate(xy.x, xy.y);
                                target.redraw(false);
                            }
                        }
                    }],
                    overflow: 'none',
                    crop: true
                }]
            });
        }
    },
    // Line type annotations:
    'segment': {
        start: function (e) {
            var x = this.chart.xAxis[0].toValue(e.chartX),
                y = this.chart.yAxis[0].toValue(e.chartY);

            return this.chart.addAnnotation({
                type: 'crooked-line',
                typeOptions: {
                    points: [{
                        x: x,
                        y: y
                    }, {
                        x: x,
                        y: y
                    }]
                }
            });
        },
        steps: [
            bindingsUtils.updateNthPoint(1)
        ]
    },
    'arrow-segment': {
        start: function (e) {
            var x = this.chart.xAxis[0].toValue(e.chartX),
                y = this.chart.yAxis[0].toValue(e.chartY);

            return this.chart.addAnnotation({
                type: 'crooked-line',
                typeOptions: {
                    line: {
                        markerEnd: 'arrow'
                    },
                    points: [{
                        x: x,
                        y: y
                    }, {
                        x: x,
                        y: y
                    }]
                }
            });
        },
        steps: [
            bindingsUtils.updateNthPoint(1)
        ]
    },
    'ray': {
        start: function (e) {
            var x = this.chart.xAxis[0].toValue(e.chartX),
                y = this.chart.yAxis[0].toValue(e.chartY);

            return this.chart.addAnnotation({
                type: 'infinity-line',
                typeOptions: {
                    type: 'ray',
                    points: [{
                        x: x,
                        y: y
                    }, {
                        x: x,
                        y: y
                    }]
                }
            });
        },
        steps: [
            bindingsUtils.updateNthPoint(1)
        ]
    },
    'arrow-ray': {
        start: function (e) {
            var x = this.chart.xAxis[0].toValue(e.chartX),
                y = this.chart.yAxis[0].toValue(e.chartY);

            return this.chart.addAnnotation({
                type: 'infinity-line',
                typeOptions: {
                    type: 'ray',
                    line: {
                        markerEnd: 'arrow'
                    },
                    points: [{
                        x: x,
                        y: y
                    }, {
                        x: x,
                        y: y
                    }]
                }
            });
        },
        steps: [
            bindingsUtils.updateNthPoint(1)
        ]
    },
    'infinity-line': {
        start: function (e) {
            var x = this.chart.xAxis[0].toValue(e.chartX),
                y = this.chart.yAxis[0].toValue(e.chartY);

            return this.chart.addAnnotation({
                type: 'infinity-line',
                typeOptions: {
                    type: 'line',
                    points: [{
                        x: x,
                        y: y
                    }, {
                        x: x,
                        y: y
                    }]
                }
            });
        },
        steps: [
            bindingsUtils.updateNthPoint(1)
        ]
    },
    'arrow-infinity-line': {
        start: function (e) {
            var x = this.chart.xAxis[0].toValue(e.chartX),
                y = this.chart.yAxis[0].toValue(e.chartY);

            return this.chart.addAnnotation({
                type: 'infinity-line',
                typeOptions: {
                    type: 'line',
                    line: {
                        markerEnd: 'arrow'
                    },
                    points: [{
                        x: x,
                        y: y
                    }, {
                        x: x,
                        y: y
                    }]
                }
            });
        },
        steps: [
            bindingsUtils.updateNthPoint(1)
        ]
    },
    'horizontal-line': {
        start: function (e) {
            var x = this.chart.xAxis[0].toValue(e.chartX),
                y = this.chart.yAxis[0].toValue(e.chartY);

            this.chart.addAnnotation({
                type: 'infinity-line',
                typeOptions: {
                    type: 'horizontal-line',
                    points: [{
                        x: x,
                        y: y
                    }]
                }
            });
        }
    },
    'vertical-line': {
        start: function (e) {
            var x = this.chart.xAxis[0].toValue(e.chartX),
                y = this.chart.yAxis[0].toValue(e.chartY);

            this.chart.addAnnotation({
                type: 'infinity-line',
                typeOptions: {
                    type: 'vertical-line',
                    points: [{
                        x: x,
                        y: y
                    }]
                }
            });
        }
    },
    // Crooked Line type annotations:
    'crooked3': {
        start: function (e) {
            var x = this.chart.xAxis[0].toValue(e.chartX),
                y = this.chart.yAxis[0].toValue(e.chartY);

            return this.chart.addAnnotation({
                type: 'crooked-line',
                typeOptions: {
                    points: [{
                        x: x,
                        y: y
                    }, {
                        x: x,
                        y: y
                    }, {
                        x: x,
                        y: y
                    }]
                }
            });
        },
        steps: [
            bindingsUtils.updateNthPoint(1),
            bindingsUtils.updateNthPoint(2)
        ]
    },
    'crooked5': {
        start: function (e) {
            var x = this.chart.xAxis[0].toValue(e.chartX),
                y = this.chart.yAxis[0].toValue(e.chartY);

            return this.chart.addAnnotation({
                type: 'crooked-line',
                typeOptions: {
                    points: [{
                        x: x,
                        y: y
                    }, {
                        x: x,
                        y: y
                    }, {
                        x: x,
                        y: y
                    }, {
                        x: x,
                        y: y
                    }, {
                        x: x,
                        y: y
                    }]
                }
            });
        },
        steps: [
            bindingsUtils.updateNthPoint(1),
            bindingsUtils.updateNthPoint(2),
            bindingsUtils.updateNthPoint(3),
            bindingsUtils.updateNthPoint(4)
        ]
    },
    'elliott3': {
        start: function (e) {
            var x = this.chart.xAxis[0].toValue(e.chartX),
                y = this.chart.yAxis[0].toValue(e.chartY);

            return this.chart.addAnnotation({
                type: 'elliott-wave',
                typeOptions: {
                    points: [{
                        x: x,
                        y: y
                    }, {
                        x: x,
                        y: y
                    }, {
                        x: x,
                        y: y
                    }]
                },
                labelOptions: {
                    style: {
                        color: '#666666'
                    }
                }
            });
        },
        steps: [
            bindingsUtils.updateNthPoint(1),
            bindingsUtils.updateNthPoint(2)
        ]
    },
    'elliott5': {
        start: function (e) {
            var x = this.chart.xAxis[0].toValue(e.chartX),
                y = this.chart.yAxis[0].toValue(e.chartY);

            return this.chart.addAnnotation({
                type: 'elliott-wave',
                typeOptions: {
                    points: [{
                        x: x,
                        y: y
                    }, {
                        x: x,
                        y: y
                    }, {
                        x: x,
                        y: y
                    }, {
                        x: x,
                        y: y
                    }, {
                        x: x,
                        y: y
                    }]
                },
                labelOptions: {
                    style: {
                        color: '#666666'
                    }
                }
            });
        },
        steps: [
            bindingsUtils.updateNthPoint(1),
            bindingsUtils.updateNthPoint(2),
            bindingsUtils.updateNthPoint(3),
            bindingsUtils.updateNthPoint(4)
        ]
    },
    'measureX': {
        start: function (e) {
            var x = this.chart.xAxis[0].toValue(e.chartX),
                y = this.chart.yAxis[0].toValue(e.chartY),
                options = {
                    type: 'measure',
                    typeOptions: {
                        selectType: 'x',
                        point: {
                            x: x,
                            y: y,
                            xAxis: 0,
                            yAxis: 0
                        },
                        crosshairX: {
                            strokeWidth: 1,
                            stroke: '#000000'
                        },
                        crosshairY: {
                            enabled: false,
                            strokeWidth: 0,
                            stroke: '#000000'
                        },
                        background: {
                            width: 0,
                            height: 0,
                            strokeWidth: 0,
                            stroke: '#ffffff'
                        }
                    },
                    labelOptions: {
                        style: {
                            color: '#666666'
                        }
                    }
                };

            return this.chart.addAnnotation(options);
        },
        steps: [
            updateRectSize
        ]
    },
    'measureY': {
        start: function (e) {
            var x = this.chart.xAxis[0].toValue(e.chartX),
                y = this.chart.yAxis[0].toValue(e.chartY),
                options = {
                    type: 'measure',
                    typeOptions: {
                        selectType: 'y',
                        point: {
                            x: x,
                            y: y,
                            xAxis: 0,
                            yAxis: 0
                        },
                        crosshairX: {
                            enabled: false,
                            strokeWidth: 0,
                            stroke: '#000000'
                        },
                        crosshairY: {
                            strokeWidth: 1,
                            stroke: '#000000'
                        },
                        background: {
                            width: 0,
                            height: 0,
                            strokeWidth: 0,
                            stroke: '#ffffff'
                        }
                    },
                    labelOptions: {
                        style: {
                            color: '#666666'
                        }
                    }
                };

            return this.chart.addAnnotation(options);
        },
        steps: [
            updateRectSize
        ]
    },
    'measureXY': {
        start: function (e) {
            var x = this.chart.xAxis[0].toValue(e.chartX),
                y = this.chart.yAxis[0].toValue(e.chartY),
                options = {
                    type: 'measure',
                    typeOptions: {
                        selectType: 'xy',
                        point: {
                            x: x,
                            y: y,
                            xAxis: 0,
                            yAxis: 0
                        },
                        background: {
                            width: 0,
                            height: 0,
                            strokeWidth: 0,
                            stroke: '#000000'
                        },
                        crosshairX: {
                            strokeWidth: 1,
                            stroke: '#000000'
                        },
                        crosshairY: {
                            strokeWidth: 1,
                            stroke: '#000000'
                        }
                    },
                    labelOptions: {
                        style: {
                            color: '#666666'
                        }
                    }
                };

            return this.chart.addAnnotation(options);
        },
        steps: [
            updateRectSize
        ]
    },
    // Advanced type annotations:
    'fibonacci': {
        start: function (e) {
            var x = this.chart.xAxis[0].toValue(e.chartX),
                y = this.chart.yAxis[0].toValue(e.chartY);
            return this.chart.addAnnotation({
                type: 'fibonacci',
                typeOptions: {
                    points: [{
                        x: x,
                        y: y
                    }, {
                        x: x,
                        y: y
                    }]
                },
                labelOptions: {
                    style: {
                        color: '#666666'
                    }
                }
            });
        },
        steps: [
            bindingsUtils.updateNthPoint(1),
            bindingsUtils.updateHeight
        ]
    },
    'parallel-channel': {
        start: function (e) {
            var x = this.chart.xAxis[0].toValue(e.chartX),
                y = this.chart.yAxis[0].toValue(e.chartY);

            return this.chart.addAnnotation({
                type: 'tunnel',
                typeOptions: {
                    points: [{
                        x: x,
                        y: y
                    }, {
                        x: x,
                        y: y
                    }]
                }
            });
        },
        steps: [
            bindingsUtils.updateNthPoint(1),
            bindingsUtils.updateHeight
        ]
    },
    'pitchfork': {
        start: function (e) {
            var x = this.chart.xAxis[0].toValue(e.chartX),
                y = this.chart.yAxis[0].toValue(e.chartY);

            return this.chart.addAnnotation({
                type: 'pitchfork',
                typeOptions: {
                    points: [{
                        x: x,
                        y: y,
                        controlPoint: {
                            style: {
                                fill: 'red'
                            }
                        }
                    }, {
                        x: x,
                        y: y
                    }, {
                        x: x,
                        y: y
                    }],
                    innerBackground: {
                        fill: 'rgba(100, 170, 255, 0.8)'
                    }
                },
                shapeOptions: {
                    strokeWidth: 2
                }
            });
        },
        steps: [
            bindingsUtils.updateNthPoint(1),
            bindingsUtils.updateNthPoint(2)
        ]
    },
    // Labels with arrow and auto increments
    'vertical-counter': {
        start: function (e) {
            var closestPoint = bindingsUtils.attractToPoint(e, this.chart),
                annotation;

            if (!defined(this.verticalCounter)) {
                this.verticalCounter = 0;
            }

            annotation = this.chart.addAnnotation({
                type: 'vertical-line',
                typeOptions: {
                    point: {
                        x: closestPoint.x,
                        y: closestPoint.y,
                        xAxis: closestPoint.xAxis,
                        yAxis: closestPoint.yAxis
                    },
                    label: {
                        offset: closestPoint.below ? 40 : -40,
                        text: this.verticalCounter.toString()
                    }
                },
                labelOptions: {
                    style: {
                        color: '#666666',
                        fontSize: '11px'
                    }
                },
                shapeOptions: {
                    stroke: 'rgba(0, 0, 0, 0.75)',
                    strokeWidth: 1
                }
            });

            this.verticalCounter++;

            annotation.options.events.click.call(annotation, {});
        }
    },
    'vertical-label': {
        start: function (e) {
            var closestPoint = bindingsUtils.attractToPoint(e, this.chart),
                annotation;

            annotation = this.chart.addAnnotation({
                type: 'vertical-line',
                typeOptions: {
                    point: {
                        x: closestPoint.x,
                        y: closestPoint.y,
                        xAxis: closestPoint.xAxis,
                        yAxis: closestPoint.yAxis
                    },
                    label: {
                        offset: closestPoint.below ? 40 : -40
                    }
                },
                labelOptions: {
                    style: {
                        color: '#666666',
                        fontSize: '11px'
                    }
                },
                shapeOptions: {
                    stroke: 'rgba(0, 0, 0, 0.75)',
                    strokeWidth: 1
                }
            });

            annotation.options.events.click.call(annotation, {});
        }
    },
    'vertical-arrow': {
        start: function (e) {
            var closestPoint = bindingsUtils.attractToPoint(e, this.chart),
                annotation;

            annotation = this.chart.addAnnotation({
                type: 'vertical-line',
                typeOptions: {
                    point: {
                        x: closestPoint.x,
                        y: closestPoint.y,
                        xAxis: closestPoint.xAxis,
                        yAxis: closestPoint.yAxis
                    },
                    label: {
                        offset: closestPoint.below ? 40 : -40,
                        format: ' '
                    },
                    connector: {
                        fill: 'none',
                        stroke: closestPoint.below ? 'red' : 'green'
                    }
                },
                shapeOptions: {
                    stroke: 'rgba(0, 0, 0, 0.75)',
                    strokeWidth: 1
                }
            });

            annotation.options.events.click.call(annotation, {});
        }
    },
    'vertical-double-arrow': {

    },
    // Flag types:
    'flag-circlepin': {
        start: bindingsUtils
            .addFlagFromForm('circlepin')
    },
    'flag-diamondpin': {
        start: bindingsUtils
            .addFlagFromForm('flag')
    },
    'flag-squarepin': {
        start: bindingsUtils
            .addFlagFromForm('squarepin')
    },
    'flag-simplepin': {
        start: bindingsUtils
            .addFlagFromForm('nopin')
    },
    // Other tools:
    'zoom-x': {
        init: function () {
            this.chart.update({
                chart: {
                    zoomType: 'xy'
                }
            });
        }
    },
    'zoom-y': {
        init: function () {
            this.chart.update({
                chart: {
                    zoomType: 'y'
                }
            });
        }
    },
    'zoom-xy': {
        init: function () {
            this.chart.update({
                chart: {
                    zoomType: 'x'
                }
            });
        }
    },
    'series-type-line': {
        init: function () {
            this.chart.series[0].update({
                type: 'line'
            });
        }
    },
    'series-type-ohlc': {
        init: function () {
            this.chart.series[0].update({
                type: 'ohlc'
            });
        }
    },
    'series-type-candlestick': {
        init: function () {
            this.chart.series[0].update({
                type: 'candlestick'
            });
        }
    },
    'full-screen': {
        init: function () {
            var chart = this.chart;

            chart.fullScreen = new H.FullScreen(chart.container);
        }
    },
    'current-price-indicator': {
        init: function (button) {
            var series = this.chart.series[0],
                options = series.options,
                lastVisiblePrice = options.lastVisiblePrice &&
                                options.lastVisiblePrice.enabled,
                lastPrice = options.lastPrice && options.lastPrice.enabled;



            if (lastPrice) {
                button.firstChild.style['background-image'] =
                    'url("http://utils.highcharts.local/samples/graphics/current-price-show.svg")';
            } else {
                button.firstChild.style['background-image'] =
                    'url("http://utils.highcharts.local/samples/graphics/current-price-hide.svg")';
            }

            fireEvent(this, 'deselectButton', { button: button });

            series.update({
                // line
                lastPrice: {
                    enabled: !lastPrice,
                    color: 'red'
                },
                // label
                lastVisiblePrice: {
                    enabled: !lastVisiblePrice,
                    label: {
                        enabled: true
                    }
                }
            });
        }
    },
    'indicators': {
        init: function () {
            var toolbar = this;

            fireEvent(
                toolbar,
                'showForm',
                {
                    formType: 'indicators',
                    options: {},
                    // Callback on submit:
                    onSubmit: function (data) {
                        toolbar.utils.manageIndicators.call(toolbar, data);
                    }
                }
            );
        }
    },
    'toggle-annotations': {
        init: function (button) {
            this.toggledAnnotations = !this.toggledAnnotations;

            each(this.chart.annotations || [], function (annotation) {
                annotation.setVisibility(!this.toggledAnnotations);
            }, this);

            if (this.toggledAnnotations) {
                button.firstChild.style['background-image'] =
                    'url("http://utils.highcharts.local/samples/graphics/annotations-hidden.svg")';
            } else {
                button.firstChild.style['background-image'] =
                    'url("http://utils.highcharts.local/samples/graphics/annotations-visible.svg")';
            }

            fireEvent(this, 'deselectButton', { button: button });
        }
    },
    'save-chart': {
        init: function () {
            var toolbar = this,
                chart = toolbar.chart,
                annotations = [],
                indicators = [],
                flags = [],
                yAxes = [];

            each(chart.annotations, function (annotation, index) {
                annotations[index] = annotation.userOptions;
            });

            each(chart.series, function (series) {
                if (series instanceof H.seriesTypes.sma) {
                    indicators.push(series.userOptions);
                } else if (series.type === 'flags') {
                    flags.push(series.userOptions);
                }
            });

            each(chart.yAxis, function (yAxis) {
                if (toolbar.utils.isNotNavigatorYAxis(yAxis)) {
                    yAxes.push(yAxis.options);
                }
            });

            H.win.localStorage.setItem(
                PREFIX + 'chart',
                JSON.stringify({
                    // annotaitons: annotations,
                    indicators: indicators,
                    flags: flags,
                    yAxes: yAxes
                })
            );
        }
    }
};

// Define which options from annotations should show up in edit box:
H.Toolbar.annotationsEditable = {
    // `typeOptions` are always available
    // Nested and shared options:
    nestedOptions: {
        labelOptions: ['style', 'format', 'backgroundColor'],
        labels: ['style'],
        label: ['style'],
        style: ['fontSize', 'color'],
        background: ['fill', 'strokeWidth', 'stroke'],
        innerBackground: ['fill', 'strokeWidth', 'stroke'],
        outerBackground: ['fill', 'strokeWidth', 'stroke'],
        shapeOptions: ['fill', 'strokeWidth', 'stroke'],
        shapes: ['fill', 'strokeWidth', 'stroke'],
        line: ['strokeWidth', 'stroke'],
        backgroundColors: [true],
        connector: ['fill', 'strokeWidth', 'stroke'],
        crosshairX: ['strokeWidth', 'stroke'],
        crosshairY: ['strokeWidth', 'stroke']
    },
    // Simple shapes:
    circle: ['shapes'],
    'vertical-line': [],
    label: ['labelOptions'],
    // Measure
    measure: ['background', 'crosshairY', 'crosshairX'],
    // Others:
    fibonacci: [],
    tunnel: ['background', 'line', 'height'],
    pitchfork: ['innerBackground', 'outerBackground'],
    // Crooked lines, elliots, arrows etc:
    'crooked-line': []
};

extend(H.Toolbar.prototype, {
    // Private properties added by bindings:

    // Active (selected) annotation that is editted through popup/forms
    // activeAnnotation: Annotation

    // Holder for current step, used on mouse move to update bound object
    // mouseMoveEvent: function () {}

    // Next event in `step` array to be called on chart's click
    // nextEvent: function () {}

    // Index in the `step` array of the current event
    // stepIndex: 0

    // Flag to determine if current binding has steps
    // steps: true|false

    // Bindings holder for all events
    // selectedButton: {}

    // Holder for user options, returned from `start` event, and passed on to
    // `step`'s' and `end`.
    // currentUserDetails: {}

    /**
     * Hook for click on a button, method selcts/unselects buttons,
     * then calls `bindings.init` callback.
     *
     * @param {HTMLDOMElement} [button] Clicked button
     * @param {Object} [events] Events passed down from bindings (`init`,
     * `start`, `step`, `end`)
     * @param {Event} [clickEvent] Browser's click event
     *
     * @private
     */
    bindingsButtonClick: function (button, events, clickEvent) {
        var toolbar = this;

        toolbar.selectedButton = events;
        toolbar.selectedButtonElement = button;

        fireEvent(toolbar, 'selectButton', { button: button });

        // Call "init" event, for example to open modal window
        if (events.init) {
            events.init.call(toolbar, button, clickEvent);
        }
    },
    /**
     * Hook for click on a chart, first click on a chart calls `start` event,
     * then on all subsequent clicks iterate over `steps` array.
     * When finished, calls `end` event.
     *
     * @param {Chart} Chart that click was performed on
     * @param {Event} Browser's click event
     *
     * @private
     */
    bindingsChartClick: function (chart, clickEvent) {
        var toolbar = this,
            selectedButton = toolbar.selectedButton;

        if (
            toolbar.activeAnnotation &&
            !clickEvent.activeAnnotation &&
            // Element could be removed in the child action, e.g. button
            clickEvent.target.parentNode &&
            // TO DO: Polyfill for IE11?
            !clickEvent.target.closest('.highcharts-popup')
        ) {
            fireEvent(toolbar, 'closePopUp');
            toolbar.deselectAnnotation();
        }

        if (!selectedButton || !selectedButton.start) {
            return;
        }

        if (!toolbar.nextEvent) {
            // Call init method:
            toolbar.currentUserDetails = selectedButton.start.call(
                toolbar,
                clickEvent
            );

            // If steps exists (e.g. Annotations), bind them:
            if (selectedButton.steps) {
                toolbar.stepIndex = 0;
                toolbar.steps = true;
                toolbar.mouseMoveEvent = toolbar.nextEvent =
                    selectedButton.steps[toolbar.stepIndex];
            } else {
                fireEvent(
                    toolbar,
                    'deselectButton',
                    {
                        button: toolbar.selectedButtonElement
                    }
                );
                toolbar.steps = false;
                toolbar.selectedButton = null;
                // First click is also the last one:
                if (selectedButton.end) {
                    selectedButton.end.call(
                        toolbar,
                        clickEvent,
                        toolbar.currentUserDetails
                    );

                }
            }
        } else {

            toolbar.nextEvent.call(
                toolbar,
                clickEvent,
                toolbar.currentUserDetails
            );

            if (toolbar.steps) {

                toolbar.stepIndex++;

                if (selectedButton.steps[toolbar.stepIndex]) {
                    // If we have more steps, bind them one by one:
                    toolbar.mouseMoveEvent = toolbar.nextEvent =
                        selectedButton.steps[toolbar.stepIndex];
                } else {
                    fireEvent(
                        toolbar,
                        'deselectButton',
                        {
                            button: toolbar.selectedButtonElement
                        }
                    );
                    // That was the last step, call end():
                    if (selectedButton.end) {
                        selectedButton.end.call(
                            toolbar,
                            clickEvent,
                            toolbar.currentUserDetails
                        );
                    }
                    toolbar.nextEvent = false;
                    toolbar.mouseMoveEvent = false;
                    toolbar.selectedButton = null;
                }
            }
        }
    },
    /**
     * Hook for mouse move on a chart's container. It calls current step.
     *
     * @param {HTMLDOMElement} Chart's container
     * @param {Event} Browser's click event
     *
     * @private
     */
    bindingsContainerMouseMove: function (container, moveEvent) {
        if (this.mouseMoveEvent) {
            this.mouseMoveEvent.call(
                this,
                moveEvent,
                this.currentUserDetails
            );
        }
    },
    /**
     * Translate fields (e.g. `params.period` or `marker.styles.color`) to
     * Highcharts options object (e.g. `{ params: { period } }`).
     *
     * @param {Object} fields - Fields from popup form
     * @param {Object} config - Default config to be modified
     *
     * @return {Object} Modified config
     * @private
     */
    fieldsToOptions: function (fields, config) {
        objectEach(fields, function (value, field) {
            var parsedValue = parseFloat(value),
                path = field.split('.'),
                parent = config,
                pathLength = path.length - 1;

            // If it's a number (not "forma" options), parse it:
            if (
                isNumber(parsedValue) &&
                !value.match(/px/g) &&
                !field.match(/format/g)
            ) {
                value = parsedValue;
            }

            // Remove empty strings or values like 0
            if (value !== '') {
                each(path, function (name, index) {
                    var nextName = pick(
                        path[index + 1],
                        ''
                    );

                    if (pathLength === index) {
                        // Last index, put value:
                        parent[name] = value;
                    } else if (!parent[name]) {
                        // Create middle property:
                        parent[name] = nextName.match(/\d/g) ? [] : {};
                        parent = parent[name];
                    } else {
                        // Jump into next property
                        parent = parent[name];
                    }
                });
            }
        });
        return config;
    },
    /**
     * Shorthand method to deselect an annotation.
     */
    deselectAnnotation: function () {
        if (this.activeAnnotation) {
            this.activeAnnotation.setControlPointsVisibility(false);
            this.activeAnnotation = false;

        }
    },
    /**
     * Get current positions for all yAxes. If new axis does not have position,
     * returned is default height and last available top place.
     *
     * @param {Array} yAxes - Array of yAxes available in the chart
     * @param {Number} plotHeight - available height in the chart
     * @param {Number} defaultHeight - default height in percents
     *
     * @return {Array} An array of calculated positions in percentages. Format:
     * `{top: Number, height: Number}`
     * @private
     */
    getYAxisPositions: function (yAxes, plotHeight, defaultHeight) {
        var positions,
            allAxesHeight = 0;

        function isPercentage(prop) {
            return defined(prop) && !isNumber(prop) && prop.match('%');
        }

        positions = map(yAxes, function (yAxis) {
            var height = isPercentage(yAxis.options.height) ?
                        parseFloat(yAxis.options.height) / 100 :
                        yAxis.height / plotHeight,
                top = isPercentage(yAxis.options.top) ?
                        parseFloat(yAxis.options.top) / 100 :
                        correctFloat(
                            yAxis.top - yAxis.chart.plotTop
                        ) / plotHeight;

            // New yAxis does not contain "height" info yet
            if (!isNumber(height)) {
                height = defaultHeight / 100;
            }

            allAxesHeight = correctFloat(allAxesHeight + height);

            return {
                height: height * 100,
                top: top * 100
            };
        });

        positions.allAxesHeight = allAxesHeight;

        return positions;
    },

    /**
     * Get current resize options for each yAxis. Note that each resize is
     * linked to the next axis, except the last one which shouldn't affect
     * axes in the navigator. Because indicator can be removed with it's yAxis
     * in the middle of yAxis array, we need to bind closest yAxes back.
     *
     * @param {Array} yAxes - Array of yAxes available in the chart
     *
     * @return {Array} An array of resizer options. Format:
     * `{enabled: Boolean, controlledAxis: { next: [String]}}`
     * @private
     */
    getYAxisResizers: function (yAxes) {
        var resizers = [];

        each(yAxes, function (yAxis, index) {
            var nextYAxis = yAxes[index + 1];

            // We have next axis, bind them:
            if (nextYAxis) {
                resizers[index] = {
                    enabled: true,
                    controlledAxis: {
                        next: [
                            pick(
                                nextYAxis.options.id,
                                nextYAxis.options.index
                            )
                        ]
                    }
                };
            } else {
                // Remove binding:
                resizers[index] = {
                    enabled: false
                };
            }
        });

        return resizers;
    },
    /**
     * Resize all yAxes (except navigator) to fit the plotting height. Method
     * checks if new axis is added, then shrinks other main axis up to 5 panes.
     * If added is more thatn 5 panes, it rescales all other axes to fit new
     * yAxis.
     *
     * If axis is removed, and we have more than 5 panes, rescales all other
     * axes. If chart has less than 5 panes, first pane receives all extra
     * space.
     *
     * @param {Number} defaultHeight - default height for yAxis
     *
     * @private
     */
    resizeYAxes: function (defaultHeight) {
        defaultHeight = defaultHeight || 20; // in %, but as a number
        var chart = this.chart,
            // Only non-navigator axes
            yAxes = grep(
                chart.yAxis,
                this.utils.isNotNavigatorYAxis
            ),
            plotHeight = chart.plotHeight,
            allAxesLength = yAxes.length,
            // Gather current heights (in %)
            positions = this.getYAxisPositions(
                yAxes,
                plotHeight,
                defaultHeight
            ),
            resizers = this.getYAxisResizers(yAxes),
            allAxesHeight = positions.allAxesHeight,
            changedSpace = defaultHeight;

        // More than 100%
        if (allAxesHeight > 1) {
            // Simple case, add new panes up to 5
            if (allAxesLength < 6) {
                // Added axis, decrease first pane's height:
                positions[0].height = correctFloat(
                    positions[0].height - changedSpace
                );
                // And update all other "top" positions:
                positions = this.recalculateYAxisPositions(
                    positions,
                    changedSpace
                );
            } else {
                // We have more panes, rescale all others to gain some space,
                // This is new height for upcoming yAxis:
                defaultHeight = 100 / allAxesLength;
                // This is how much we need to take from each other yAxis:
                changedSpace = defaultHeight / (allAxesLength - 1);

                // Now update all positions:
                positions = this.recalculateYAxisPositions(
                    positions,
                    changedSpace,
                    true,
                    -1
                );
            }
            // Set last position manually:
            positions[allAxesLength - 1] = {
                top: correctFloat(100 - defaultHeight),
                height: defaultHeight
            };

        } else {
            // Less than 100%
            changedSpace = correctFloat(1 - allAxesHeight) * 100;
            // Simple case, return first pane it's space:
            if (allAxesLength < 5) {
                positions[0].height = correctFloat(
                    positions[0].height + changedSpace
                );

                positions = this.recalculateYAxisPositions(
                    positions,
                    changedSpace
                );
            } else {
                // There were more panes, return to each pane a bit of space:
                changedSpace /= allAxesLength;
                // Removed axis, add extra space to the first pane:
                // And update all other positions:
                positions = this.recalculateYAxisPositions(
                    positions,
                    changedSpace,
                    true,
                    1
                );
            }
        }

        each(positions, function (position, index) {
            // if (index === 0) debugger;
            yAxes[index].update({
                height: position.height + '%',
                top: position.top + '%',
                resize: resizers[index]
            }, false);
        });
    },
    /**
     * Utility to modify calculated positions according to the remaining/needed
     * space. Later, these positions are used in `yAxis.update({ top, height })`
     *
     * @param {Array} positions - default positions of all yAxes
     * @param {Number} changedSpace - how much space should be added or removed
     * @param {Number} adder - `-1` or `1`, to determine whether we should add
     * or remove space
     * @param {Boolean} modifyHeight - update only `top` or both `top` and
     * `height`
     *
     * @return {Array} positions - modified positions
     *
     * @private
     */
    recalculateYAxisPositions: function (
        positions,
        changedSpace,
        modifyHeight,
        adder
    ) {
        each(positions, function (position, index) {
            var prevPosition = positions[index - 1];

            position.top = !prevPosition ? 0 :
                correctFloat(prevPosition.height + prevPosition.top);

            if (modifyHeight) {
                position.height = correctFloat(
                    position.height + adder * changedSpace
                );
            }
        });

        return positions;
    },
    /**
     * Generates API config for popup in the same format as options for
     * Annotation object.
     *
     * @param {Annotation} Annotations object
     * @return {Object} Annotation options to be displayed in popup box
     */
    annotationToFields: function (annotation) {
        var options = annotation.options,
            editables = H.Toolbar.annotationsEditable,
            nestedEditables = editables.nestedOptions,
            getFieldType = this.utils.getFieldType,
            type = pick(
                options.type,
                options.shapes && options.shapes[0] &&
                    options.shapes[0].type,
                options.labels && options.labels[0] &&
                    options.labels[0].itemType,
                'label'
            ),
            visualOptions = {
                type: type
            };

        /**
         * Nested options traversing. Method goes down to the options and copies
         * allowed options (with values) to new object, which is last parameter:
         * "parent".
         *
         * @param {*} option/value - atomic type or object/array
         * @param {String} key - option name, for example "visible" or "x", "y"
         * @param {Object} allowed editables from H.Toolbar.annotationsEditable
         * @param {Object} parent - where new options will be assigned
         */
        function traverse(option, key, parentEditables, parent) {
            var nextParent;
            // debugger;
            if (
                parentEditables &&
                (
                    inArray(key, parentEditables) >= 0 ||
                    parentEditables[key] || // nested array
                    parentEditables === true // simple array
                )
            ) {
                // Roots:
                if (isArray(option)) {
                    parent[key] = [];
                    each(option, function (arrayOption, i) {
                        if (!isObject(arrayOption)) {
                            // Simple arrays, e.g. [String, Number, Boolean]
                            traverse(
                                arrayOption,
                                0,
                                nestedEditables[key],
                                parent[key]
                            );
                        } else {
                            // Advanced arrays, e.g. [Object, Object]
                            parent[key][i] = {};
                            objectEach(
                                arrayOption,
                                function (nestedOption, nestedKey) {
                                    traverse(
                                        nestedOption,
                                        nestedKey,
                                        nestedEditables[key],
                                        parent[key][i]
                                    );
                                }
                            );
                        }
                    });
                } else if (isObject(option)) {
                    nextParent = {};
                    if (isArray(parent)) {
                        parent.push(nextParent);
                        nextParent[key] = {};
                        nextParent = nextParent[key];
                    } else {
                        parent[key] = nextParent;
                    }
                    objectEach(option, function (nestedOption, nestedKey) {
                        traverse(
                            nestedOption,
                            nestedKey,
                            key === 0 ? parentEditables : nestedEditables[key],
                            nextParent
                        );
                    });
                } else {
                    // Leaf:
                    if (key === 'format') {
                        parent[key] = [
                            H.format(
                                option,
                                annotation.labels[0].points[0]
                            ).toString(),
                            'text'
                        ];
                    } else if (isArray(parent)) {
                        parent.push([option, getFieldType(option)]);
                    } else {
                        parent[key] = [option, getFieldType(option)];
                    }
                }
            }
        }

        objectEach(options, function (option, key) {
            if (key === 'typeOptions') {
                visualOptions[key] = {};
                objectEach(options[key], function (typeOption, typeKey) {
                    traverse(
                        typeOption,
                        typeKey,
                        nestedEditables,
                        visualOptions[key],
                        true
                    );
                });
            } else {
                traverse(option, key, editables[type], visualOptions);
            }
        });

        return visualOptions;
    },

    /**
     * Get all class names for all parents in the element. Iterates until finds
     * main container.
     *
     * @param {Highcharts.HTMLDOMElement} - container that event is bound to
     * @param {Event} event - browser's event
     *
     * @return {Array} Array of class names with corresponding elements
     */
    getClickedClassNames: function (container, event) {
        var element = event.target,
            classNames = [],
            elemClassName;

        while (element) {
            elemClassName = H.attr(element, 'class');
            if (elemClassName) {
                classNames.push([
                    elemClassName.replace('highcharts-', ''),
                    element
                ]);
            }
            element = element.parentNode;

            if (element === container) {
                return classNames;
            }
        }

        return classNames;

    },
    /**
     * Get events bound to a button. It's a custom event delegation to find
     * all events connected to the element.
     *
     * @param {Highcharts.HTMLDOMElement} - container that event is bound to
     * @param {Event} event - browser's event
     *
     * @return {*} object with events (init, start, steps and end)
     */
    getButtonEvents: function (container, event) {
        var options = this.chart.options.stockTools.bindings,
            classNames = this.getClickedClassNames(container, event),
            bindings;

        each(classNames, function (className) {
            if (options[className[0]]) {
                bindings = {
                    events: options[className[0]],
                    element: className[1]
                };
            }
        });

        return bindings;
    },
    /**
     * General utils for bindings
     */
    utils: bindingsUtils
});

addEvent(H.Toolbar, 'afterInit', function () {
    var toolbar = this,
        options = toolbar.chart.options.stockTools,
        toolbarContainer = doc.getElementsByClassName(
            options.gui.toolbarClassName
        );

    // Handle multiple containers with the same class names:
    each(toolbarContainer, function (subContainer) {
        addEvent(
            subContainer,
            'click',
            function (event) {
                var bindings = toolbar.getButtonEvents(
                    toolbarContainer,
                    event
                );

                if (bindings) {
                    toolbar.bindingsButtonClick(
                        bindings.element,
                        bindings.events,
                        event
                    );
                }
            }
        );
    });
});

addEvent(H.Chart, 'load', function () {
    var chart = this,
        toolbar = chart.stockToolbar;

    if (toolbar) {
        addEvent(chart, 'click', function (e) {
            toolbar.bindingsChartClick(this, e);
        });
        addEvent(chart.container, 'mousemove', function (e) {
            toolbar.bindingsContainerMouseMove(this, e);
        });
    }
});

// Show edit-annotation form:
function selectableAnnotation(annotationType) {
    var originalClick = annotationType.prototype.defaultOptions.events &&
            annotationType.prototype.defaultOptions.events.click;

    function selectAndShowForm(event) {
        var annotation = this,
            toolbar = annotation.chart.stockToolbar,
            prevAnnotation = toolbar.activeAnnotation;

        if (originalClick) {
            originalClick.click.call(annotation, event);
        }

        if (prevAnnotation !== annotation) {
            // Select current:
            toolbar.deselectAnnotation();

            toolbar.activeAnnotation = annotation;
            annotation.setControlPointsVisibility(true);

            fireEvent(
                toolbar,
                'showForm',
                {
                    formType: 'annotation-toolbar',
                    options: toolbar.annotationToFields(annotation),
                    onSubmit: function (data) {

                        var config = {},
                            typeOptions;

                        if (data.actionType === 'remove') {
                            toolbar.activeAnnotation = false;
                            toolbar.chart.removeAnnotation(annotation);
                        } else {
                            toolbar.fieldsToOptions(data.fields, config);
                            toolbar.deselectAnnotation();

                            typeOptions = config.typeOptions;

                            if (annotation.options.type === 'measure') {
                                // Manually disable crooshars according to
                                // stroke width of the shape:
                                typeOptions.crosshairY.enabled =
                                    typeOptions.crosshairY.strokeWidth !== 0;
                                typeOptions.crosshairX.enabled =
                                    typeOptions.crosshairX.strokeWidth !== 0;
                            }

                            annotation.update(config);
                        }
                    }
                }
            );
        } else {
            // Deselect current:
            toolbar.deselectAnnotation();
            fireEvent(toolbar, 'closePopUp');
        }
        // Let bubble event to chart.click:
        event.activeAnnotation = true;
    }

    H.merge(
        true,
        annotationType.prototype.defaultOptions.events,
        {
            click: selectAndShowForm
        }
    );
}

if (H.Annotation) {
    // Basic shapes:
    selectableAnnotation(H.Annotation);

    // Advanced annotations:
    H.objectEach(H.Annotation.types, function (annotationType) {
        selectableAnnotation(annotationType);
    });
}

H.setOptions({
    stockTools: {
        bindings: stockToolsBindings
    }
});
