// Chart.defaults.global.defaultFontFamily = 'Nunito', '-apple-system,system-ui,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif';
// Chart.defaults.global.defaultFontColor = '#858796';

function number_format(number, decimals, dec_point, thousands_sep) {
    // *     example: number_format(1234.56, 2, ',', ' ');
    // *     return: '1 234,56'
    number = (number + '').replace(',', '').replace(' ', '');
    var n = !isFinite(+number) ? 0 : +number,
      prec = !isFinite(+decimals) ? 0 : Math.abs(decimals),
      sep = (typeof thousands_sep === 'undefined') ? ',' : thousands_sep,
      dec = (typeof dec_point === 'undefined') ? '.' : dec_point,
      s = '',
      toFixedFix = function(n, prec) {
        var k = Math.pow(10, prec);
        return '' + Math.round(n * k) / k;
      };
    // Fix for IE parseFloat(0.55).toFixed(0) = 0;
    s = (prec ? toFixedFix(n, prec) : '' + Math.round(n)).split('.');
    if (s[0].length > 3) {
      s[0] = s[0].replace(/\B(?=(?:\d{3})+(?!\d))/g, sep);
    }
    if ((s[1] || '').length < prec) {
      s[1] = s[1] || '';
      s[1] += new Array(prec - s[1].length + 1).join('0');
    }
    return s.join(dec);
  }

var ws;
var historicalLineChart;

function lastIndexBeforeTimestamp(timestamp, data) {
    for(var i = data.length-1; i > 0; i--) {
        if(timestamp <= parseInt(data[i].timestamp)) {
            continue;
        } else {
            return i;
        }
    }
}

function renderDataOnChart(chartID, data) {

    console.log("Rendering " + chartID);
    var labels = data.map((entry) => { return entry.date});
    var values = data.map((entry) => { return entry.price.toFixed(2)});
    if(historicalLineChart) historicalLineChart.destroy();
    var chart = $(`#${chartID}`);
    historicalLineChart = new Chart(chart, {
    type: 'line',
    data: {
        labels: labels,
        datasets: [{
        label: "Oracle price",
        lineTension: 0.3,
        backgroundColor: "rgba(78, 115, 223, 0.05)",
        borderColor: "rgba(78, 115, 223, 1)",
        pointRadius: 3,
        pointBackgroundColor: "rgba(78, 115, 223, 1)",
        pointBorderColor: "rgba(78, 115, 223, 1)",
        pointHoverRadius: 3,
        pointHoverBackgroundColor: "rgba(78, 115, 223, 1)",
        pointHoverBorderColor: "rgba(78, 115, 223, 1)",
        pointHitRadius: 10,
        pointBorderWidth: 2,
        data: values,
        }],
    },
    options: {
        maintainAspectRatio: false,
        layout: {
        padding: {
            left: 10,
            right: 25,
            top: 25,
            bottom: 0
        }
        },
        scales: {
        xAxes: [{
            time: {
                unit: 'date'
            },
            gridLines: {
                display: false,
                drawBorder: false
            },
            ticks: {
                maxTicksLimit: 4,
                callback: function(value, index, values) {
                    return value.toLocaleString();
                }
            }
        }],
        yAxes: [{
            ticks: {
                maxTicksLimit: 5,
                padding: 10,
                // Include a dollar sign in the ticks
                callback: function(value, index, values) {
                    return '$' + number_format(value);
                }
            },
            gridLines: {
                color: "rgb(234, 236, 244)",
                zeroLineColor: "rgb(234, 236, 244)",
                drawBorder: false,
                borderDash: [2],
                zeroLineBorderDash: [2]
            }
        }],
        },
        legend: {
        display: false
        },
        tooltips: {
        backgroundColor: "rgb(255,255,255)",
        bodyFontColor: "#858796",
        titleMarginBottom: 10,
        titleFontColor: '#6e707e',
        titleFontSize: 14,
        borderColor: '#dddfeb',
        borderWidth: 1,
        xPadding: 15,
        yPadding: 15,
        displayColors: false,
        intersect: false,
        mode: 'index',
        caretPadding: 10,
        callbacks: {
            label: function(tooltipItem, chart) {
                var datasetLabel = chart.datasets[tooltipItem.datasetIndex].label || '';
                var label = datasetLabel + ': $' + tooltipItem.yLabel.toFixed(2);
                if(data[tooltipItem.index].blocknumber) {
                    label += '\n' + 'Block Number: ' + data[tooltipItem.index].blocknumber;
                }
                return label;
            }
        }
        }
    }
    });
}

var lastUpdatedAt;
var lastUpdatedTimer = setInterval(() => {
    if(lastUpdatedAt) {
        var now = new Date();
        var diff = ((now - lastUpdatedAt) / 1000).toFixed(0);
        $('#last-updated-label').text(`Last updated ${diff} seconds ago`); 
    }
}, 1000);

var curHistoricalData;

function renderSelectedData() {
    if(!curHistoricalData) return;

    var maxIndex = curHistoricalData.length-1;
    var minTimestamp = (Date.now() - $('#historical-data-time-period-selector').val()) / 1000;
    var minIndex = lastIndexBeforeTimestamp(minTimestamp, curHistoricalData); // Math.max(0, maxIndex - 1000);
    renderDataOnChart("historical-data-chart", curHistoricalData.slice(minIndex,maxIndex));
}

$(document).ready(function(e) {
    $('#historical-data-time-period-selector').change(() => {
        renderSelectedData();
    })
    $("#historical-data-modal").on("hidden.bs.modal", function () {
        // put your default event here
        $('#historical-data-time-period-selector').val("604800000");
    });

    ws = new WebSocket('wss://api.oracles.club:5678');
    ws.onmessage = function(e) {
        console.log(e);
        lastUpdatedAt = new Date();
        $('#price-feed-table-spinner').addClass('d-none');
        //$('#last-updated-label').text('Last updated at ' + now.toTimeString())


        var update = JSON.parse(e.data);
        const priceFeedMainSelector = '#price-feed-cards'
        for(var priceFeed in update) {
            var lowerPriceFeed = priceFeed.toLowerCase();
            if($(`#${lowerPriceFeed}-price-table-body`).length === 0) {
                var elem = $(`<div class="card mb-4">
                    <div class="card-header py-3">
                        <h6 class="m-0 font-weight-bold text-primary">${priceFeed}</h6>
                    </div>
                    <div class="card-body">
                        <div class="table-responsive">
                            <table class="table table-bordered" style="font-size:16px" id="dataTable" width="100%" cellspacing="0">
                            <thead>
                                <tr>
                                    <th>Price Feed</th>
                                    <th>Current Value</th>
                                    <th>Last Updated</th>
                                    <th>Previous Value</th>
                                </tr>
                            </thead>
                            <tbody id='${lowerPriceFeed}-price-table-body'>
                            </tbody>
                            </table>
                        </div>
                    </div>
                </div>`)
                $(priceFeedMainSelector).append(elem);
            }

            var priceFeedUpdate = update[priceFeed];
            var priceFeedTableSelector = `#${lowerPriceFeed}-price-table-body`;

            for(var protocol in priceFeedUpdate) {
                var lowerProtocol = protocol.toLowerCase();
                var rowSelector = `${lowerPriceFeed}-${lowerProtocol}-price-feed`
                var lastUpdatedDate = new Date(priceFeedUpdate[protocol].last_updated * 1000);

                if($(`#${rowSelector}-row`).length === 0) {
                    var elem = $(`<tr id=\'${rowSelector}-row\'>`)
                    .append($(`<td id=\'${rowSelector}-title\'><a href=${lowerProtocol}.html>${protocol}</a></td>`))
                    .append($(`<td id=\'${rowSelector}-cur-price\'>`).append($(`<a href=\'#\' class='historical-data-link' id=\'${rowSelector}-cur-price-link\'>`)))
                    .append($(`<td id=\'${rowSelector}-last-updated\'>`))
                    .append($(`<td id=\'${rowSelector}-prev-price\'>`))
                    $(priceFeedTableSelector).append(elem)
                }

                $(`#${rowSelector}-cur-price-link`).text(priceFeedUpdate[protocol].cur_price.toFixed(2));
                $(`#${rowSelector}-last-updated`).text(lastUpdatedDate.toUTCString());
                $(`#${rowSelector}-prev-price`).text((priceFeedUpdate[protocol].prev_price.toFixed(2)));

                $(`#${rowSelector}-cur-price-link`).unbind();
                $(`#${rowSelector}-cur-price-link`).click({
                    feed: priceFeed,
                    protocol : protocol
                }, (e) => {
                    var protocolQueryParam = e.data.protocol.toLowerCase();
                    var feedQueryParam;
                    switch(e.data.feed) {
                        case 'ETHUSD' : feedQueryParam =  'ETH'; break;
                        case 'BTCUSD' : feedQueryParam =  'BTC'; break;
                        case 'BATUSD' : feedQueryParam =  'BAT'; break;
                        default: return ''; break;
                    }
                    $('#historical-data-modal-title').text(`Historical ${e.data.feed} data for ${e.data.protocol}`);
                    $.get(`https://api.oracles.club/${protocolQueryParam}${feedQueryParam}`, (historicalRequestData) => {
                        historicalRequestData = JSON.parse(historicalRequestData);
                        var cleanRequestData = historicalRequestData.map((value) => {
                            value.date = new Date(value.timestamp * 1000);
                            return value;
                        })

                        curHistoricalData = cleanRequestData;
                        renderSelectedData();
                    });
                    $('#historical-data-modal').modal();
                })
            }
        }
    };

    ws.onopen = function(e) {
        console.log("open");
        //console.log(e);
    }

});